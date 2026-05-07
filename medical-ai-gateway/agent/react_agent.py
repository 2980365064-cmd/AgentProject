from typing import Iterator, Optional
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from agent.tools.agent_tools import book_appointment, filter_doctors_by_department, get_all_doctor_info, \
    get_doctor_info, \
    get_patient_info, rag_summarize, \
    get_weather, \
    get_user_location, \
    get_user_id, get_current_month, fetch_external_data, fill_context_for_report, summarize_symptoms, \
    current_bearer_token
from agent.tools.middleware import log_before_model, monitor_tool
from model.factory import backup_chat_model, chat_model
from utils.logger_handler import logger
from utils.prompts_loader import load_health_prompt, load_management_prompt
from utils.redis_chat_history import get_messages, save_messages


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
            yield from self._execute_stream_inner(query, session_id, assistant_profile, user_id)
        finally:
            if reset_tok is not None:
                current_bearer_token.reset(reset_tok)

    def _execute_stream_inner(
        self,
        query: str,
        session_id: Optional[str],
        assistant_profile: str,
        user_id: Optional[str],
    ) -> Iterator[str]:
        # ✅ 传递 assistant_profile 和 user_id 给 get_messages
        prior: list[dict[str, str]] = get_messages(session_id, assistant_profile, user_id) if session_id else []
        messages_input = [*prior, {"role": "user", "content": query}]
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
            # ✅ 传递 assistant_profile 和 user_id 给 save_messages
            save_messages(
                session_id,
                [*prior, {"role": "user", "content": query}, {"role": "assistant", "content": assistant_text}],
                assistant_profile,
                user_id
            )
            logger.info(f"✅ 消息已保存到 Redis (session_id={session_id}, profile={assistant_profile})")

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



