from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from typing import Optional, Union, Any
import uuid
import json
import asyncio
import os
import tempfile
import urllib.request
from pathlib import Path
from datetime import datetime

from agent.react_agent import ReactAgent
from model.factory import chat_model
from utils.redis_chat_history import get_messages, clear_session, get_redis_client, session_exists
from utils.config_handler import redis_conf
from utils.logger_handler import logger
from agentApi.response import ApiResult, ChatData, SessionCreateData, SessionHistoryData, SessionListData, SessionListItem, MessageItem, HealthData, ResultCode
from rag.vector_store import VectorStoreService

# ==================== 统一 API 前缀和版本控制 ====================
API_PREFIX = "/api"
API_VERSION = "v1"
BASE_PATH = f"{API_PREFIX}/{API_VERSION}"

app = FastAPI(
    title="医疗AI智能问答系统",
    description="为传统医疗管理系统提供AI智能问答服务",
    version="1.0.0",
    docs_url=f"{BASE_PATH}/docs",
    redoc_url=f"{BASE_PATH}/redoc",
    openapi_url=f"{BASE_PATH}/openapi.json"
)

# 初始化Agent实例（全局单例）
agent = ReactAgent()

# ✅ 初始化向量知识库服务
vector_store_service = VectorStoreService()

@app.on_event("startup")
async def startup_event():
    """应用启动时自动加载新文档到向量库"""
    logger.info("🚀 开始初始化 Elasticsearch 向量知识库...")
    try:
        # 显示当前文档数量
        count = vector_store_service.vector_store.get_document_count()
        logger.info(f"📊 当前知识库文档数量: {count}")
        
        # 加载新文档
        vector_store_service.load_document()
        
        # 再次显示文档数量
        new_count = vector_store_service.vector_store.get_document_count()
        logger.info(f"✅ 向量知识库初始化完成，当前文档总数: {new_count}")
    except Exception as e:
        logger.error(f"❌ 向量知识库初始化失败: {e}", exc_info=True)


class ChatRequest(BaseModel):
    user_input: str = Field(..., description="用户输入的问题", min_length=1, max_length=2000)
    session_id: Optional[str] = Field(None, description="会话ID，用于关联对话历史（可选，不提供则自动创建）")
    user_id: Optional[Any] = Field(None, description="用户ID（从JWT解析，可以是整数或字符串）")
    user_role: Optional[str] = Field(None, description="用户角色：PATIENT/DOCTOR等")
    assistant_profile: Optional[str] = Field(None, description="助手档案：health/management")
    bearer_token: Optional[str] = Field(None, description="Java 网关透传的 JWT，供 book_appointment 等工具回调后端")


class SessionDeleteRequest(BaseModel):
    session_id: str = Field(..., description="要删除的会话ID")


class SessionCreateBody(BaseModel):
    """POST /sessions 请求体：仅需可选标题，勿复用 ChatRequest（其含必填 session_id）"""

    user_input: Optional[str] = Field(None, description="会话标题（与聊天接口字段名一致）", max_length=50)
    title: Optional[str] = Field(None, description="会话标题别名", max_length=50)
    user_id: Optional[Any] = Field(None, description="用户ID（从JWT解析，可以是整数或字符串）")
    user_role: Optional[str] = Field(None, description="用户角色：PATIENT/DOCTOR等")
    assistant_profile: Optional[str] = Field(None, description="助手档案：health/management")

CRITICAL_KEYWORDS = [
    "胸痛", "胸闷", "喘不上气", "呼吸困难", "大量出血",
    "吐血", "昏迷", "失去意识", "剧痛", "自杀", "轻生"
]


def keyword_interceptor(user_input: str) -> bool:
    """关键词拦截器：检测危急症状关键词"""
    for word in CRITICAL_KEYWORDS:
        if word in user_input:
            return True
    return False


def semantic_interceptor(user_input: str) -> bool:
    """语义拦截器：通过LLM判断是否为危重症"""
    try:
        prompt = PromptTemplate.from_template("""
        你是急诊科护士，判断用户描述的症状是否属于危重症。
        如果是危重症，只回复 YES；如果不是，只回复 NO。不要回复其他内容。
        用户描述：{input}
        """)
        chain = prompt | chat_model | StrOutputParser()
        result = chain.invoke({"input": user_input})
        return result.strip().upper() == "YES"
    except Exception as e:
        logger.error(f"语义拦截器异常: {type(e).__name__}: {str(e)}")
        logger.warning("⚠️ LLM 不可用，跳过语义拦截，依赖关键词拦截")
        return False


# ==================== 健康检查（根路径） ====================
@app.get(f"{BASE_PATH}/health", summary="健康检查", tags=["System"])
async def health_check():
    """
    服务健康检查
    
    - 检查Redis连接状态
    - 返回服务基本信息
    
    统一返回格式：ApiResult<HealthData>
    """
    try:
        r = get_redis_client()
        redis_status = "connected" if r.ping() else "disconnected"
    except Exception as e:
        logger.error(f"Redis健康检查失败: {str(e)}")
        redis_status = "error"
    
    health_data = HealthData(redis=redis_status)
    return ApiResult.success(data=health_data, message="服务运行正常")


# ==================== 会话管理模块 ====================

@app.post(f"{BASE_PATH}/sessions", summary="创建新会话", tags=["Session"])
async def create_session(body: Union[SessionCreateBody, None] = None):
    """
    创建新的会话
    
    URL: POST /api/v1/sessions
    Body (可选): {"user_input": "标题", "user_id": "xxx", "user_role": "PATIENT", "assistant_profile": "health"}
    """
    try:
        session_id = str(uuid.uuid4())
        created_at = int(datetime.now().timestamp())
        
        custom_title = "新对话"
        user_id = None
        user_role = None
        assistant_profile = "health"
        
        if body is not None:
            raw = (body.user_input or body.title or "").strip()
            if raw:
                custom_title = raw[:50]
            
            user_id = body.user_id
            if user_id is not None:
                user_id = str(user_id)
            
            user_role = body.user_role
            assistant_profile = body.assistant_profile or "health"
        
        logger.info(f"创建新会话: {session_id}, 标题: {custom_title}, 用户: {user_id}, 角色: {user_role}, 档案: {assistant_profile}")
        
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        
        # ✅ 新的 Key 格式：包含 assistant_profile 和 user_id，实现物理隔离
        key = f"{prefix}{assistant_profile}:{user_id}:{session_id}"
        
        session_data = {
            "title": custom_title,
            "messages": [],
            "created_at": created_at,
            "user_id": user_id,
            "user_role": user_role,
            "assistant_profile": assistant_profile,
            "session_id": session_id  # 额外存储 session_id，方便查找
        }
        
        ttl = int(redis_conf.get("ttl_seconds", 604800))
        if ttl > 0:
            r.setex(key, ttl, json.dumps(session_data, ensure_ascii=False))
        else:
            r.set(key, json.dumps(session_data, ensure_ascii=False))
        
        logger.info(f"✓ 会话 {session_id} 已在 Redis 中初始化，Key: {key}, 档案: {assistant_profile}")
        
        create_data = SessionCreateData(id=session_id, createdAt=created_at)
        return ApiResult.success(data=create_data, message="会话创建成功")
    
    except Exception as e:
        logger.error(f"创建会话失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"创建会话失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.get(f"{BASE_PATH}/sessions", summary="获取所有活跃会话列表", tags=["Session"])
async def list_sessions(user_id: Optional[str] = None, assistant_profile: Optional[str] = None):
    """
    获取Redis中所有活跃的会话列表
    
    URL: GET /api/v1/sessions?user_id=xxx&assistant_profile=health
    
    参数说明：
    - user_id: 可选，按用户ID过滤
    - assistant_profile: 可选，按助手档案过滤（health/management）
    """
    try:
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        
        # ✅ 根据 assistant_profile 构建扫描模式
        if assistant_profile and user_id:
            scan_pattern = f"{prefix}{assistant_profile}:{user_id}:*"
        elif assistant_profile:
            scan_pattern = f"{prefix}{assistant_profile}:*"
        elif user_id:
            # 如果没有指定 profile，需要扫描所有 profile
            scan_pattern = f"{prefix}*:{user_id}:*"
        else:
            scan_pattern = f"{prefix}*"
        
        logger.info(f"扫描会话模式: {scan_pattern}")
        
        sessions_list = []
        for key in r.scan_iter(match=scan_pattern, count=100):
            raw = r.get(key)
            
            if not raw:
                continue
            
            try:
                session_data = json.loads(raw)
                
                if not isinstance(session_data, dict):
                    continue
                
                session_id = session_data.get("session_id", "")
                if not session_id:
                    # 从 key 中提取 session_id
                    parts = key.split(":")
                    if len(parts) >= 4:
                        session_id = parts[-1]
                
                title = session_data.get("title", "新对话")
                messages = session_data.get("messages", [])
                stored_user_id = session_data.get("user_id")
                stored_user_role = session_data.get("user_role")
                stored_assistant_profile = session_data.get("assistant_profile", "health")
                created_at = session_data.get("created_at", int(datetime.now().timestamp()))
                
                sessions_list.append(SessionListItem(
                    id=session_id,
                    title=title,
                    createdAt=created_at,
                    updatedAt=created_at,
                    messageCount=len(messages)
                ))
            except Exception as e:
                logger.warning(f"解析会话数据失败: {key}, 错误: {e}")
                continue
        
        logger.info(f"当前活跃会话数: {len(sessions_list)} (过滤条件: user_id={user_id}, profile={assistant_profile})")
        
        list_data = SessionListData(sessions=sessions_list, total=len(sessions_list))
        return ApiResult.success(data=list_data, message="获取会话列表成功")
    
    except Exception as e:
        logger.error(f"获取会话列表失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"获取会话列表失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.get(f"{BASE_PATH}/sessions/{{session_id}}/history", summary="获取会话历史", tags=["Session"])
async def get_session_history(session_id: str, user_id: Optional[str] = None, assistant_profile: Optional[str] = None):
    """
    获取指定会话的历史对话记录
    
    URL: GET /api/v1/sessions/{session_id}/history?user_id=xxx&assistant_profile=health
    """
    if not session_id:
        return ApiResult.error(message="会话ID不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        
        # ✅ 根据提供的参数构建可能的 key
        keys_to_try = []
        if assistant_profile and user_id:
            keys_to_try.append(f"{prefix}{assistant_profile}:{user_id}:{session_id}")
        elif user_id:
            # 尝试两种 profile
            keys_to_try.append(f"{prefix}health:{user_id}:{session_id}")
            keys_to_try.append(f"{prefix}management:{user_id}:{session_id}")
        else:
            # 最坏情况：扫描所有可能
            for key in r.scan_iter(match=f"{prefix}*:{session_id}", count=10):
                keys_to_try.append(key)
        
        messages = []
        for key in keys_to_try:
            raw = r.get(key)
            if raw:
                try:
                    session_data = json.loads(raw)
                    if isinstance(session_data, dict):
                        messages = session_data.get("messages", [])
                        logger.info(f"找到会话历史: {key}")
                        break
                except Exception as e:
                    logger.warning(f"解析会话数据失败: {key}, 错误: {e}")
        
        # 转换为 MessageItem 格式
        message_items = []
        now_ts = int(datetime.now().timestamp())
        for msg in messages:
            message_items.append(MessageItem(
                role=msg["role"],
                content=msg["content"],
                timestamp=now_ts
            ))
        
        history_data = SessionHistoryData(messages=message_items)
        return ApiResult.success(data=history_data, message="获取会话历史成功")
    
    except Exception as e:
        logger.error(f"获取会话 {session_id} 历史失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"获取会话历史失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.delete(f"{BASE_PATH}/sessions/{{session_id}}", summary="删除会话", tags=["Session"])
async def delete_session(session_id: str, user_id: Optional[str] = None, assistant_profile: Optional[str] = None):
    """
    删除指定会话及其历史记录
    
    URL: DELETE /api/v1/sessions/{session_id}?user_id=xxx&assistant_profile=health
    """
    if not session_id:
        return ApiResult.error(message="会话ID不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        
        deleted = False
        
        # ✅ 根据提供的参数构建可能的 key
        if assistant_profile and user_id:
            key = f"{prefix}{assistant_profile}:{user_id}:{session_id}"
            if r.exists(key):
                r.delete(key)
                deleted = True
                logger.info(f"成功删除会话: {key}")
        else:
            # 扫描所有可能的 key 并删除
            for key in r.scan_iter(match=f"{prefix}*:{session_id}", count=10):
                r.delete(key)
                deleted = True
                logger.info(f"成功删除会话: {key}")
        
        if not deleted:
            logger.warning(f"尝试删除不存在的会话: {session_id}")
            return ApiResult.success(message="会话不存在或已被删除")
        
        return ApiResult.success(message="会话已成功删除")
    
    except Exception as e:
        logger.error(f"删除会话 {session_id} 失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"删除会话失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)

# ==================== 智能问答模块 ====================

@app.post(f"{BASE_PATH}/chat/messages", summary="发送消息进行智能问答", tags=["Chat"])
async def chat(request: ChatRequest):
    """
    智能问答核心接口
    """
    user_input = request.user_input
    session_id = request.session_id
    assistant_profile = request.assistant_profile or "health"
    user_id = str(request.user_id) if request.user_id else None
    
    # ✅ 如果 session_id 为空，自动创建
    if not session_id:
        import uuid
        from datetime import datetime
        session_id = str(uuid.uuid4())
        logger.info(f"🆕 未提供session_id，自动创建新会话: {session_id}")
        
        try:
            r = get_redis_client()
            prefix = redis_conf.get("key_prefix", "agent:chat:")
            key = f"{prefix}{assistant_profile}:{user_id}:{session_id}"
            
            session_data = {
                "title": "新对话",
                "messages": [],
                "created_at": int(datetime.now().timestamp()),
                "user_id": user_id,
                "user_role": request.user_role,
                "assistant_profile": assistant_profile,
                "session_id": session_id
            }
            
            ttl = int(redis_conf.get("ttl_seconds", 604800))
            if ttl > 0:
                r.setex(key, ttl, json.dumps(session_data, ensure_ascii=False))
            else:
                r.set(key, json.dumps(session_data, ensure_ascii=False))
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
    
    logger.info(f"📥 收到聊天请求: user_input={user_input[:50]}, session_id={session_id}, assistant_profile={assistant_profile}, user_id={user_id}")
    
    if not user_input or not user_input.strip():
        return ApiResult.error(message="用户输入不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        # ✅ 危急症状拦截
        if keyword_interceptor(user_input):
            logger.warning(f"会话 {session_id} 触发关键词拦截: {user_input[:50]}")
            
            emergency_response = (
                "⚠️ **重要提醒**\n\n"
                "我注意到您描述的症状可能比较严重。根据您提到的情况，我强烈建议您：\n\n"
                "1. **立即就医**：请尽快前往最近的医院急诊科就诊\n"
                "2. **拨打急救电话**：如果情况紧急，请立即拨打 120\n"
                "3. **不要延误**：这些症状需要专业医生的及时评估和处理\n\n"
                "为了您的健康安全，请不要仅依赖在线咨询服务，务必寻求专业医疗帮助。\n\n"
                "如果您有其他非紧急的健康问题，我很乐意为您提供帮助。"
            )
            
            chat_data = ChatData(response=emergency_response, session_id=session_id)
            return ApiResult.success(data=chat_data, message="问答成功")
        
        if semantic_interceptor(user_input):
            logger.warning(f"会话 {session_id} 触发语义拦截: {user_input[:50]}")
            
            emergency_response = (
                "⚠️ **重要提醒**\n\n"
                "根据您的描述，您的症状可能需要紧急医疗关注。为了您的安全，我建议您：\n\n"
                "1. **尽快就医**：请立即前往医院急诊科或联系您的医生\n"
                "2. **紧急情况拨打 120**：如果症状严重或突然加重，请立刻拨打急救电话\n"
                "3. **寻求专业帮助**：这些症状需要专业医护人员进行评估\n\n"
                "在线健康咨询无法替代面对面的医疗诊断。请务必重视您的健康状况，及时就医。\n\n"
                "如有其他健康问题，我会继续为您提供支持。"
            )
            
            chat_data = ChatData(response=emergency_response, session_id=session_id)
            return ApiResult.success(data=chat_data, message="问答成功")
        
        logger.info(f"🤖 调用 Agent，assistant_profile={assistant_profile}, user_id={user_id}")
        response_text = ""
        for chunk in agent.execute_stream(
            user_input, session_id, assistant_profile, user_id, request.bearer_token
        ):
            response_text += chunk
        
        logger.info(f"会话 {session_id} 问答成功（档案: {assistant_profile}），响应长度: {len(response_text)}")
        
        chat_data = ChatData(response=response_text, session_id=session_id)
        return ApiResult.success(data=chat_data, message="问答成功")
    
    except Exception as e:
        logger.error(f"会话 {session_id} 处理异常: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"AI服务处理失败: {str(e)}", code=ResultCode.ERROR)


@app.post(f"{BASE_PATH}/chat/stream", summary="发送消息进行智能问答（SSE流式返回）", tags=["Chat"])
async def chat_stream(request: ChatRequest):
    """
    智能问答流式接口（SSE - Server-Sent Events）
    
    - 接收用户问题和会话ID
    - 实时流式返回AI生成的内容（打字机效果）
    - 自动进行危急症状拦截
    - 根据 assistant_profile 选择对应工具集
    - 自动保存对话历史到Redis
    
    URL: POST /api/v1/chat/stream
    Content-Type: text/event-stream
    """
    user_input = request.user_input
    session_id = request.session_id
    assistant_profile = request.assistant_profile or "health"
    user_id = str(request.user_id) if request.user_id else None
    
    # ✅ 如果 session_id 为空或未提供，自动创建新会话
    if not session_id:
        import uuid
        from datetime import datetime
        session_id = str(uuid.uuid4())
        logger.info(f"🆕 未提供session_id，自动创建新会话: {session_id}")
        
        # 在Redis中初始化会话
        try:
            r = get_redis_client()
            prefix = redis_conf.get("key_prefix", "agent:chat:")
            key = f"{prefix}{assistant_profile}:{user_id}:{session_id}"
            
            session_data = {
                "title": "新对话",
                "messages": [],
                "created_at": int(datetime.now().timestamp()),
                "user_id": user_id,
                "user_role": request.user_role,
                "assistant_profile": assistant_profile,
                "session_id": session_id
            }
            
            ttl = int(redis_conf.get("ttl_seconds", 604800))
            if ttl > 0:
                r.setex(key, ttl, json.dumps(session_data, ensure_ascii=False))
            else:
                r.set(key, json.dumps(session_data, ensure_ascii=False))
            
            logger.info(f"✓ 会话 {session_id} 已在 Redis 中初始化")
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
    
    if not user_input or not user_input.strip():
        error_data = json.dumps({"error": "用户输入不能为空"}, ensure_ascii=False)
        return StreamingResponse(iter([f"data: {error_data}\n\n"]), media_type="text/event-stream")
    
    async def event_generator():
        """SSE 事件生成器"""
        try:
            if keyword_interceptor(user_input):
                logger.warning(f"会话 {session_id} 触发关键词拦截: {user_input[:50]}")
                
                emergency_response = (
                    "⚠️ **重要提醒**\n\n"
                    "我注意到您描述的症状可能比较严重。根据您提到的情况，我强烈建议您：\n\n"
                    "1. **立即就医**：请尽快前往最近的医院急诊科就诊\n"
                    "2. **拨打急救电话**：如果情况紧急，请立即拨打 120\n"
                    "3. **不要延误**：这些症状需要专业医生的及时评估和处理\n\n"
                    "为了您的健康安全，请不要仅依赖在线咨询服务，务必寻求专业医疗帮助。\n\n"
                    "如果您有其他非紧急的健康问题，我很乐意为您提供帮助。"
                )
                
                words = emergency_response.split(' ')
                for i in range(0, len(words), 3):
                    chunk = ' '.join(words[i:i+3])
                    data = json.dumps({"content": chunk + " ", "done": False}, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0.05)
                
                done_data = json.dumps({
                    "content": "",
                    "done": True,
                    "session_id": session_id,
                    "full_response": emergency_response
                }, ensure_ascii=False)
                yield f"data: {done_data}\n\n"
                return
            
            if semantic_interceptor(user_input):
                logger.warning(f"会话 {session_id} 触发语义拦截: {user_input[:50]}")
                
                emergency_response = (
                    "⚠️ **重要提醒**\n\n"
                    "根据您的描述，您的症状可能需要紧急医疗关注。为了您的安全，我建议您：\n\n"
                    "1. **尽快就医**：请立即前往医院急诊科或联系您的医生\n"
                    "2. **紧急情况拨打 120**：如果症状严重或突然加重，请立刻拨打急救电话\n"
                    "3. **寻求专业帮助**：这些症状需要专业医护人员进行评估\n\n"
                    "在线健康咨询无法替代面对面的医疗诊断。请务必重视您的健康状况，及时就医。\n\n"
                    "如有其他健康问题，我会继续为您提供支持。"
                )
                
                words = emergency_response.split(' ')
                for i in range(0, len(words), 3):
                    chunk = ' '.join(words[i:i+3])
                    data = json.dumps({"content": chunk + " ", "done": False}, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0.05)
                
                done_data = json.dumps({
                    "content": "",
                    "done": True,
                    "session_id": session_id,
                    "full_response": emergency_response
                }, ensure_ascii=False)
                yield f"data: {done_data}\n\n"
                return
            
            full_response = ""
            for chunk in agent.execute_stream(
                user_input, session_id, assistant_profile, user_id, request.bearer_token
            ):
                full_response += chunk
                data = json.dumps({"content": chunk, "done": False}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            
            logger.info(f"会话 {session_id} 流式问答成功（档案: {assistant_profile}），响应长度: {len(full_response)}")
            
            done_data = json.dumps({
                "content": "",
                "done": True,
                "session_id": session_id,
                "full_response": full_response
            }, ensure_ascii=False)
            yield f"data: {done_data}\n\n"
        
        except Exception as e:
            logger.error(f"会话 {session_id} 流式处理异常: {str(e)}", exc_info=True)
            error_data = json.dumps({"error": f"AI服务处理失败: {str(e)}"}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ==================== 管理端知识库：MinIO 合并后 Kafka 异步入库 ====================

class KnowledgeIngestRequest(BaseModel):
    fileId: Optional[int] = Field(None, description="Java 侧记录 ID")
    uploadId: str
    bucket: str
    objectKey: str
    presignedDownloadUrl: str
    originalFilename: str
    contentType: str
    ingestSourceKey: str


class DeleteBySourcePrefixRequest(BaseModel):
    sourcePrefix: str = Field(..., min_length=1)


def _download_to_tempfile(url: str, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        urllib.request.urlretrieve(url, path)
    except Exception:
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    return path


@app.post(f"{BASE_PATH}/knowledge/ingest", summary="管理端知识文件入库（预签名 URL）", tags=["Knowledge"])
async def knowledge_ingest(body: KnowledgeIngestRequest):
    """供 Java Kafka 消费者调用：下载 MinIO 预签名链接，解析后写入 ES"""
    try:
        suffix = Path(body.originalFilename).suffix or ".bin"
        if suffix.lower() not in (".pdf", ".txt"):
            return ApiResult.error(
                message="仅支持 .pdf / .txt",
                code=ResultCode.BAD_REQUEST,
            )
        tmp_path = _download_to_tempfile(body.presignedDownloadUrl, suffix)
        try:
            n = vector_store_service.ingest_admin_file(
                tmp_path, body.originalFilename, body.ingestSourceKey
            )
            return ApiResult.success(data={"chunks": n}, message="向量入库成功")
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except Exception as e:
        logger.error(f"知识库入库失败: {e}", exc_info=True)
        return ApiResult.error(message=f"入库失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.post(f"{BASE_PATH}/knowledge/delete-by-source-prefix", summary="按 source 前缀删除向量", tags=["Knowledge"])
async def knowledge_delete_by_prefix(body: DeleteBySourcePrefixRequest):
    try:
        deleted = vector_store_service.vector_store.delete_by_source_prefix(body.sourcePrefix)
        return ApiResult.success(data={"deleted": deleted}, message="删除完成")
    except Exception as e:
        logger.error(f"按前缀删除失败: {e}", exc_info=True)
        return ApiResult.error(message=str(e), code=ResultCode.INTERNAL_ERROR)
