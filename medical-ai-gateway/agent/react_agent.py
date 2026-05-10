import re
from typing import Iterator, Optional
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from agent.tools.agent_tools import book_appointment, filter_doctors_by_department, get_all_doctor_info, \
    get_doctor_info, \
    get_patient_info, rag_summarize, \
    get_weather, \
    get_user_location, \
    get_user_id, get_current_month, fetch_external_data, fill_context_for_report, summarize_symptoms, \
    current_bearer_token, recommend_doctor_by_symptom
from agent.tools.middleware import log_before_model, monitor_tool
from intent_manager import initialize_intent_library
from model.factory import backup_chat_model, chat_model
from router.semantic import semantic_router
from router.appointment_state_machine import AppointmentStateMachine
from memory.working_memory import get_working_memory_store
from memory.session_memory import get_session_memory_manager
from memory.long_term_memory import get_long_term_memory_store
from utils.logger_handler import logger
from utils.prompts_loader import load_health_prompt, load_management_prompt
from utils.redis_chat_history import get_messages


def _final_assistant_text(messages: list) -> str:
    """从完整消息列表中取最后一条有正文的助手回复（兼容工具调用后的终答）。"""
    last = ""
    for m in messages:
        if isinstance(m, AIMessage):
            c = m.content
            if isinstance(c, str) and c.strip():
                last = c.strip()
            elif isinstance(c, list):
                texts = []
                for block in c:
                    if isinstance(block, dict) and block.get("type") == "text":
                        texts.append(block.get("text", ""))
                joined = "".join(texts).strip()
                if joined:
                    last = joined
    return last


class ReactAgent:
    """
    ReactAgent 是一个基于 LangChain 的代理，用于处理用户输入并生成回复。
    """
    model = chat_model.with_fallbacks([backup_chat_model])
    
    def __init__(self):
        self._tools_cache = {}
        self._agents_cache = {}
        self._appointment_sm = AppointmentStateMachine()
        self._working_memory = get_working_memory_store()
        self._session_memory = get_session_memory_manager()
        self._long_term_memory = get_long_term_memory_store()
        try:
            initialize_intent_library()
        except Exception as e:
            logger.warning(f"意图向量库初始化失败，将回退到 LLM 路由: {e}")

    @staticmethod
    def _is_explicit_history_query(query: str) -> bool:
        """
        规则1：用户显式要求“回忆历史”时，强制查询 L3。
        """
        text = (query or "").strip()
        if not text:
            return False
        keywords = (
            "之前", "上次", "还记得", "历史", "以前", "曾经",
            "之前说过", "上回", "前面聊到", "你记得吗",
        )
        return any(k in text for k in keywords)

    @staticmethod
    def _looks_like_form_filling_query(query: str) -> bool:
        """
        识别“流程填参类输入”（例如预约补槽），这类输入通常不需要 L3。
        """
        text = (query or "").strip()
        if not text:
            return False

        slot_keywords = (
            "患者姓名", "医生姓名", "日期", "时间", "NIC", "身份证",
            "姓名：", "医生：", "日期：", "时间：",
        )
        if any(k in text for k in slot_keywords):
            return True

        # 常见时间/日期/NIC 片段，通常表示在补充表单字段
        if re.search(r"\b20\d{2}-\d{1,2}-\d{1,2}\b", text):
            return True
        if re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", text):
            return True
        if re.search(r"\b[A-Za-z]{2,}[A-Za-z0-9]{3,}\b", text):
            return True

        # 纯短人名输入（例如“张三”）也视为补槽
        if re.fullmatch(r"[\u4e00-\u9fa5A-Za-z·]{2,8}", text):
            return True
        return False

    @staticmethod
    def _is_consultation_query(query: str) -> bool:
        """
        规则2：咨询类问法（且不是流程填参）才触发此条件的 L3。
        """
        text = (query or "").strip()
        if not text:
            return False
        if ReactAgent._looks_like_form_filling_query(text):
            return False
        consult_keywords = (
            "怎么办", "为什么", "怎么", "原因", "症状", "治疗", "用药",
            "风险", "建议", "可以吗", "是否", "会不会", "如何",
            "是什么", "注意事项", "要不要",
        )
        return any(k in text for k in consult_keywords) or len(text) >= 18

    @staticmethod
    def _is_l2_summary_insufficient(summary: str, profile: dict) -> bool:
        """
        规则3：L2 摘要为空或信息过少时，允许查 L3 做补充。
        """
        s = (summary or "").strip()
        if not s:
            return True
        # 摘要过短且画像也很空，判定为“信息不足”
        if len(s) < 20 and (not profile or len(profile.keys()) == 0):
            return True
        return False

    def _should_query_long_term_memory(
        self,
        query: str,
        short_ctx: dict,
    ) -> tuple[bool, str]:
        """
        L3 门控：仅在满足条件时检索长期记忆。
        """
        summary = short_ctx.get("conversation_summary", "")
        profile = short_ctx.get("user_profile", {})
        messages = short_ctx.get("messages", [])

        if self._is_explicit_history_query(query):
            return True, "explicit_history_query"
        if self._is_consultation_query(query):
            return True, "consultation_query"
        if self._is_l2_summary_insufficient(summary, profile):
            return True, "l2_summary_insufficient"
        if len(messages) == 0:
            # 会话首轮（冷启动）
            return True, "session_cold_start"
        return False, "no_trigger"
    
    def _get_tools_for_profile(self, assistant_profile: str) -> list:
        """根据助手档案返回对应的工具列表"""
        if assistant_profile in self._tools_cache:
            return self._tools_cache[assistant_profile]
        
        if assistant_profile == "health":
            tools = [
                rag_summarize,
                get_weather,
                get_user_location,
                get_doctor_info,
                get_patient_info,
                get_all_doctor_info,
                summarize_symptoms,
                filter_doctors_by_department,
                book_appointment,
            ]
            logger.info(f"加载健康助手工具集: {[t.name for t in tools]}")
        
        elif assistant_profile == "management":
            tools = [
                fetch_external_data,
                fill_context_for_report,
                get_user_id,
                get_current_month,
                rag_summarize,
                get_doctor_info,
                get_patient_info,
                get_all_doctor_info,
                summarize_symptoms,
                filter_doctors_by_department,
                book_appointment
            ]
            logger.info(f"加载管理助手工具集: {[t.name for t in tools]}")
        
        else:
            logger.warning(f"未知的助手档案: {assistant_profile}，使用默认工具集")
            tools = [rag_summarize]
        
        self._tools_cache[assistant_profile] = tools
        return tools
    
    def _create_agent_for_profile(self, assistant_profile: str):
        """为指定助手档案创建 Agent 实例（带缓存）"""
        if assistant_profile in self._agents_cache:
            logger.debug(f"使用缓存的 Agent 实例 (档案: {assistant_profile})")
            return self._agents_cache[assistant_profile]
        
        tools = self._get_tools_for_profile(assistant_profile)
        
        # 根据 assistant_profile 选择固定的提示词
        if assistant_profile == "health":
            system_prompt = load_health_prompt()
            logger.info("创建健康助手 Agent（使用健康提示词）")
        else:
            system_prompt = load_management_prompt()
            logger.info("创建管理助手 Agent（使用管理提示词）")
        

        agent = create_agent(
            model=self.model,
            system_prompt=system_prompt,
            tools=tools,
            middleware=[monitor_tool, log_before_model],
        )
        
        self._agents_cache[assistant_profile] = agent
        logger.info(f"✓ Agent 实例已缓存 (档案: {assistant_profile})")
        
        return agent

    @staticmethod
    def _should_start_appointment_flow(query: str) -> bool:
        text = (query or "").strip()
        if not text:
            return False

        booking_keywords = (
            "预约", "挂号", "约号", "帮我挂", "帮我约", "门诊预约"
        )
        doctor_query_keywords = (
            "推荐医生", "适合的医生", "查询医生", "找医生", "哪个医生", "医生建议", "看哪个医生"
        )

        has_booking = any(k in text for k in booking_keywords)
        has_doctor_query = any(k in text for k in doctor_query_keywords)

        # 明确是“查医生/推荐医生”但未表达预约，不进入预约状态机
        if has_doctor_query and not has_booking:
            return False
        return has_booking
    
    def execute_stream(
        self,
        query: str,
        session_id: Optional[str] = None,
        assistant_profile: str = "health",
        user_id: Optional[str] = None,
        bearer_token: Optional[str] = None,
    ) -> Iterator[str]:
        """执行流式问答"""
        logger.info(f"🔧 ReactAgent.execute_stream: session_id={session_id}, assistant_profile={assistant_profile}, user_id={user_id}")
        
        reset_tok = None
        if bearer_token and bearer_token.strip():
            reset_tok = current_bearer_token.set(bearer_token.strip())
        try:
            session_key = self._build_sm_session_key(session_id, assistant_profile, user_id)
            self._working_memory.set(
                session_key,
                current_task="routing",
                current_node="start",
                temporary_params={"query": query[:200]},
            )
            in_appointment_flow = self._appointment_sm.has_active_session(session_key)
            if in_appointment_flow:
                should_route_appointment = True
            else:
                decision = semantic_router(query, threshold=0.30)
                should_route_appointment = (
                    decision.action == "book_appointment"
                    and self._should_start_appointment_flow(query)
                )

            if should_route_appointment:
                self._working_memory.set(
                    session_key,
                    current_task="appointment",
                    current_node="collecting_slots",
                    temporary_params={"query": query[:200]},
                )
                sm_result = self._appointment_sm.handle(session_key, query)
                if not sm_result.done:
                    self._working_memory.set(
                        session_key,
                        current_task="appointment",
                        current_node="awaiting_user_info",
                        temporary_params=sm_result.payload or {},
                        last_tool_result=sm_result.response[:200],
                    )
                    self._save_direct_reply(session_id, assistant_profile, user_id, query, sm_result.response)
                    yield sm_result.response + "\n"
                    return
                if sm_result.payload:
                    booking_payload = dict(sm_result.payload)
                    if not (booking_payload.get("doctor_name") or "").strip():
                        symptom_text = (booking_payload.get("symptom_description") or "").strip()
                        if symptom_text:
                            recommended_doctor = recommend_doctor_by_symptom(symptom_text)
                            if recommended_doctor:
                                booking_payload["doctor_name"] = recommended_doctor
                                logger.info(
                                    f"🤖 根据症状自动推荐医生: symptom={symptom_text!r}, doctor={recommended_doctor!r}"
                                )
                            else:
                                ask_text = "我还不能确定具体医生，请直接告诉我医生姓名（例如：张一山医生）。"
                                self._working_memory.set(
                                    session_key,
                                    current_task="appointment",
                                    current_node="awaiting_doctor_name",
                                    temporary_params={"symptom_description": symptom_text},
                                    last_tool_result=ask_text[:200],
                                )
                                self._save_direct_reply(session_id, assistant_profile, user_id, query, ask_text)
                                yield ask_text + "\n"
                                return

                    booking_payload.pop("symptom_description", None)
                    self._working_memory.set(
                        session_key,
                        current_task="appointment",
                        current_node="executing_booking_tool",
                        temporary_params=booking_payload,
                    )
                    booking_text = book_appointment.invoke(booking_payload)
                    self._save_direct_reply(session_id, assistant_profile, user_id, query, booking_text)
                    self._working_memory.set(
                        session_key,
                        current_task="appointment",
                        current_node="completed",
                        temporary_params=booking_payload,
                        last_tool_result=booking_text[:200],
                    )
                    yield booking_text + "\n"
                    return

            yield from self._execute_stream_inner(query, session_id, assistant_profile, user_id, session_key)
        finally:
            if reset_tok is not None:
                current_bearer_token.reset(reset_tok)

    @staticmethod
    def _build_sm_session_key(
        session_id: Optional[str],
        assistant_profile: str,
        user_id: Optional[str],
    ) -> str:
        sid = session_id or "no-session"
        uid = user_id or "anonymous"
        return f"{assistant_profile}:{uid}:{sid}"

    @staticmethod
    def _save_direct_reply(
        session_id: Optional[str],
        assistant_profile: str,
        user_id: Optional[str],
        query: str,
        assistant_text: str,
    ):
        if not session_id:
            return
        # 统一通过 L2 会话记忆入口写入：
        # - 保留 30 轮短期消息
        # - 触发滚动摘要与用户画像更新
        # - 触发长期记忆向量入库
        get_session_memory_manager().append_turn(
            session_id=session_id,
            assistant_profile=assistant_profile,
            user_id=user_id,
            user_text=query,
            assistant_text=assistant_text,
        )
        logger.info(
            f"✅ 直连路由消息已保存 (session_id={session_id}, profile={assistant_profile}, user={user_id})"
        )

    def _build_memory_context(
        self,
        session_id: Optional[str],
        assistant_profile: str,
        user_id: Optional[str],
        query: str,
        session_key: str,
    ) -> str:
        """
        组装三级记忆上下文（L1 + L2 + L3）。
        """
        sections: list[str] = []
        short_ctx = {"conversation_summary": "", "user_profile": {}, "messages": []}

        # L1 工作记忆
        wm = self._working_memory.get(session_key)
        if wm:
            sections.append(
                "【工作记忆】\n"
                f"- current_task: {wm.get('current_task', '')}\n"
                f"- current_node: {wm.get('current_node', '')}\n"
                f"- temporary_params: {wm.get('temporary_params', {})}\n"
                f"- last_tool_result: {wm.get('last_tool_result', '')}"
            )

        # L2 会话记忆（摘要 + 画像）
        if session_id:
            short_ctx = self._session_memory.get_short_term_context(
                session_id=session_id,
                assistant_profile=assistant_profile,
                user_id=user_id,
            )
            summary = short_ctx.get("conversation_summary", "")
            profile = short_ctx.get("user_profile", {})
            if summary or profile:
                sections.append(
                    "【会话记忆】\n"
                    f"- conversation_summary: {summary or '无'}\n"
                    f"- user_profile: {profile or {}}"
                )

        # L3 长期记忆（跨会话召回，按条件触发，避免每轮都查导致延迟）
        should_l3, reason = self._should_query_long_term_memory(query, short_ctx)
        if should_l3:
            ltm_hits = self._long_term_memory.search(
                user_id=str(user_id) if user_id is not None else None,
                assistant_profile=assistant_profile,
                query=query,
                top_k=3,
            )
            logger.info(f"L3 检索触发: reason={reason}, hits={len(ltm_hits)}")
            if ltm_hits:
                lines = []
                for idx, hit in enumerate(ltm_hits, start=1):
                    lines.append(
                        f"{idx}. (score={hit.get('score', 0):.3f}, type={hit.get('memory_type', '')}) {hit.get('text', '')}"
                    )
                sections.append("【长期记忆召回】\n" + "\n".join(lines))
        else:
            logger.info(f"L3 检索跳过: reason={reason}")

        if not sections:
            return ""
        return (
            "以下是系统自动整理的记忆上下文，请参考；若与用户当前明确表达冲突，以当前输入为准。\n\n"
            + "\n\n".join(sections)
        )

    def _execute_stream_inner(
        self,
        query: str,
        session_id: Optional[str],
        assistant_profile: str,
        user_id: Optional[str],
        session_key: str,
    ) -> Iterator[str]:
        prior: list[dict[str, str]] = get_messages(session_id, assistant_profile, user_id) if session_id else []
        memory_context = self._build_memory_context(
            session_id=session_id,
            assistant_profile=assistant_profile,
            user_id=user_id,
            query=query,
            session_key=session_key,
        )
        messages_input = [*prior]
        if memory_context:
            # 记忆上下文作为 system 消息注入，降低“忘记当前任务/历史事实”的概率。
            messages_input.append({"role": "system", "content": memory_context})
        messages_input.append({"role": "user", "content": query})
        input_dict = {"messages": messages_input}
        
        agent = self._create_agent_for_profile(assistant_profile)
        
        final_messages: list = []
        for chunk in agent.stream(input_dict, stream_mode="values"):
            final_messages = chunk["messages"]
            latest_message = final_messages[-1]
            if isinstance(latest_message, AIMessage):
                content = latest_message.content or ""
                if isinstance(content, str) and content.strip():
                    yield content.strip() + "\n"
        
        if session_id:
            assistant_text = _final_assistant_text(final_messages)
            self._session_memory.append_turn(
                session_id=session_id,
                assistant_profile=assistant_profile,
                user_id=user_id,
                user_text=query,
                assistant_text=assistant_text,
            )
            logger.info(f"✅ 消息已保存到 Redis (session_id={session_id}, profile={assistant_profile})")
            self._working_memory.set(
                session_key,
                current_task="general_chat",
                current_node="completed",
                temporary_params={},
                last_tool_result=assistant_text[:200],
            )

if __name__ == '__main__':
    agent = ReactAgent()

    
    query = "我叫刘大炮，NIC123,骨折了给我推荐一个医生,并进行挂号预约，2026年4月1日下午一点"
    print(f"\n💬 用户提问：{query}")
    print("🤖 AI回复：\n")
    
    stream = agent.execute_stream(query, session_id="test_session_001", assistant_profile="management", user_id="1004")
    for chunk in stream:
        print(chunk, end="")
    
    print("\n" + "=" * 60)
    print("测试结束")
    print("=" * 60)



