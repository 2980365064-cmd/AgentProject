from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from typing import Optional, Union
import uuid
import json
import asyncio
from datetime import datetime

from agent.react_agent import ReactAgent
from model.factory import chat_model
from utils.redis_chat_history import get_messages, clear_session, get_redis_client, session_exists
from utils.config_handler import redis_conf
from utils.logger_handler import logger
from agentApi.response import ApiResult, ChatData, SessionCreateData, SessionHistoryData, SessionListData, SessionListItem, MessageItem, HealthData, ResultCode

# ==================== 统一 API 前缀和版本控制 ====================
API_PREFIX = "/api"
API_VERSION = "v1"
BASE_PATH = f"{API_PREFIX}/{API_VERSION}"

app = FastAPI(
    title="医疗AI智能问答系统",
    description="为传统医疗管理系统提供AI智能问答服务",
    version="1.0.0",
    docs_url=f"{BASE_PATH}/docs",      # 文档地址: /api/v1/docs
    redoc_url=f"{BASE_PATH}/redoc",    # ReDoc地址: /api/v1/redoc
    openapi_url=f"{BASE_PATH}/openapi.json"  # OpenAPI规范: /api/v1/openapi.json
)

# 初始化Agent实例（全局单例）
agent = ReactAgent()


class ChatRequest(BaseModel):
    user_input: str = Field(..., description="用户输入的问题", min_length=1, max_length=2000)
    session_id: str = Field(..., description="会话ID，用于关联对话历史")


class SessionDeleteRequest(BaseModel):
    session_id: str = Field(..., description="要删除的会话ID")


class SessionCreateBody(BaseModel):
    """POST /sessions 请求体：仅需可选标题，勿复用 ChatRequest（其含必填 session_id）"""

    user_input: Optional[str] = Field(None, description="会话标题（与聊天接口字段名一致）", max_length=50)
    title: Optional[str] = Field(None, description="会话标题别名", max_length=50)


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
        logger.error(f"语义拦截器异常: {e}")
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
    Body (可选): {"user_input": "标题"} 或 {"title": "标题"} 或 {}
    """
    try:
        session_id = str(uuid.uuid4())
        created_at = int(datetime.now().timestamp())
        
        # ✅ 支持自定义标题（勿使用 ChatRequest：会强制要求 session_id，导致仅传标题时 422）
        custom_title = "新对话"
        if body is not None:
            raw = (body.user_input or body.title or "").strip()
            if raw:
                custom_title = raw[:50]
        
        logger.info(f"创建新会话: {session_id}, 标题: {custom_title}")
        
        # ✅ 在 Redis 中初始化会话，存储标题元数据
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        key = f"{prefix}{session_id}"
        
        # 存储格式：{"title": "xxx", "messages": []}
        session_data = {
            "title": custom_title,
            "messages": [],
            "created_at": created_at
        }
        
        ttl = int(redis_conf.get("ttl_seconds", 604800))
        if ttl > 0:
            r.setex(key, ttl, json.dumps(session_data, ensure_ascii=False))
        else:
            r.set(key, json.dumps(session_data, ensure_ascii=False))
        
        logger.info(f"✓ 会话 {session_id} 已在 Redis 中初始化")
        
        create_data = SessionCreateData(id=session_id, createdAt=created_at)
        return ApiResult.success(data=create_data, message="会话创建成功")
    
    except Exception as e:
        logger.error(f"创建会话失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"创建会话失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.get(f"{BASE_PATH}/sessions", summary="获取所有活跃会话列表", tags=["Session"])
async def list_sessions():
    """
    获取Redis中所有活跃的会话列表
    
    URL: GET /api/v1/sessions
    """
    try:
        r = get_redis_client()
        prefix = redis_conf.get("key_prefix", "agent:chat:")
        
        sessions_list = []
        for key in r.scan_iter(match=f"{prefix}*", count=100):
            session_id = key.replace(prefix, "")
            
            # ✅ 读取完整的会话数据（包含标题）
            raw = r.get(key)
            title = "新对话"
            messages = []
            
            if raw:
                try:
                    session_data = json.loads(raw)
                    
                    # 兼容旧格式（直接是数组）和新格式（包含title的对象）
                    if isinstance(session_data, dict):
                        title = session_data.get("title", "新对话")
                        messages = session_data.get("messages", [])
                    elif isinstance(session_data, list):
                        # 旧格式：直接是消息数组
                        messages = session_data
                        # 从第一条用户消息生成标题
                        first_user_msg = next((m for m in messages if m.get("role") == "user"), None)
                        if first_user_msg:
                            content = first_user_msg.get("content", "")
                            title = content[:30] + ("..." if len(content) > 30 else "")
                except Exception as e:
                    logger.warning(f"解析会话 {session_id} 数据失败: {e}")
                    messages = []
            else:
                messages = []
            
            now_ts = int(datetime.now().timestamp())
            
            sessions_list.append(SessionListItem(
                id=session_id,
                title=title,
                createdAt=now_ts,
                updatedAt=now_ts,
                messageCount=len(messages)
            ))
        
        logger.info(f"当前活跃会话数: {len(sessions_list)}")
        
        list_data = SessionListData(sessions=sessions_list, total=len(sessions_list))
        return ApiResult.success(data=list_data, message="获取会话列表成功")
    
    except Exception as e:
        logger.error(f"获取会话列表失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"获取会话列表失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.get(f"{BASE_PATH}/sessions/{{session_id}}/history", summary="获取会话历史", tags=["Session"])
async def get_session_history(session_id: str):
    """
    获取指定会话的历史对话记录
    
    URL: GET /api/v1/sessions/{session_id}/history
    """
    if not session_id:
        return ApiResult.error(message="会话ID不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        messages = get_messages(session_id)
        
        # 转换为 MessageItem 格式
        message_items = []
        now_ts = int(datetime.now().timestamp())
        for msg in messages:
            message_items.append(MessageItem(
                role=msg["role"],
                content=msg["content"],
                timestamp=now_ts  # Redis未存储时间，使用当前时间
            ))
        
        history_data = SessionHistoryData(messages=message_items)
        return ApiResult.success(data=history_data, message="获取会话历史成功")
    
    except Exception as e:
        logger.error(f"获取会话 {session_id} 历史失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"获取会话历史失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)


@app.delete(f"{BASE_PATH}/sessions/{{session_id}}", summary="删除会话", tags=["Session"])
async def delete_session(session_id: str):
    """
    删除指定会话及其历史记录
    
    URL: DELETE /api/v1/sessions/{session_id}
    """
    if not session_id:
        return ApiResult.error(message="会话ID不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        if not session_exists(session_id):
            logger.warning(f"尝试删除不存在的会话: {session_id}")
            return ApiResult.success(message="会话不存在或已被删除")

        clear_session(session_id)
        logger.info(f"成功删除会话: {session_id}")
        
        return ApiResult.success(message="会话已成功删除")
    
    except Exception as e:
        logger.error(f"删除会话 {session_id} 失败: {str(e)}", exc_info=True)
        return ApiResult.error(message=f"删除会话失败: {str(e)}", code=ResultCode.INTERNAL_ERROR)

# ==================== 智能问答模块 ====================

@app.post(f"{BASE_PATH}/chat/messages", summary="发送消息进行智能问答", tags=["Chat"])
async def chat(request: ChatRequest):
    """
    智能问答核心接口
    
    - 接收用户问题和会话ID
    - 自动进行危急症状拦截
    - 返回AI生成的医疗建议
    - 自动保存对话历史到Redis
    
    统一返回格式：ApiResult<ChatData>
    
    URL: POST /api/v1/chat/messages
    """
    user_input = request.user_input
    session_id = request.session_id
    
    # 参数验证
    if not user_input or not user_input.strip():
        return ApiResult.error(message="用户输入不能为空", code=ResultCode.BAD_REQUEST)
    
    if not session_id:
        return ApiResult.error(message="会话ID不能为空", code=ResultCode.BAD_REQUEST)
    
    try:
        # ✅ 危急症状拦截 - 关键词检测（改为自然语言回复）
        if keyword_interceptor(user_input):
            logger.warning(f"会话 {session_id} 触发关键词拦截: {user_input[:50]}")
            
            # 使用更温和的自然语言回复，但仍强调紧急性
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
        
        # ✅ 危急症状拦截 - 语义检测（改为自然语言回复）
        if semantic_interceptor(user_input):
            logger.warning(f"会话 {session_id} 触发语义拦截: {user_input[:50]}")
            
            # 使用更温和的自然语言回复，但仍强调紧急性
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
        
        # 正常对话流程 - 收集流式响应
        response_text = ""
        for chunk in agent.execute_stream(user_input, session_id):
            response_text += chunk
        
        logger.info(f"会话 {session_id} 问答成功，响应长度: {len(response_text)}")
        
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
    - 自动保存对话历史到Redis
    
    URL: POST /api/v1/chat/stream
    Content-Type: text/event-stream
    """
    user_input = request.user_input
    session_id = request.session_id
    
    # 参数验证
    if not user_input or not user_input.strip():
        error_data = json.dumps({"error": "用户输入不能为空"}, ensure_ascii=False)
        return StreamingResponse(iter([f"data: {error_data}\n\n"]), media_type="text/event-stream")
    
    if not session_id:
        error_data = json.dumps({"error": "会话ID不能为空"}, ensure_ascii=False)
        return StreamingResponse(iter([f"data: {error_data}\n\n"]), media_type="text/event-stream")
    
    async def event_generator():
        """SSE 事件生成器"""
        try:
            # ✅ 危急症状拦截 - 关键词检测
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
                
                # 分块发送紧急提示（模拟打字机效果）
                words = emergency_response.split(' ')
                for i in range(0, len(words), 3):
                    chunk = ' '.join(words[i:i+3])
                    data = json.dumps({"content": chunk + " ", "done": False}, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0.05)  # 模拟打字延迟
                
                # 发送完成信号
                done_data = json.dumps({
                    "content": "",
                    "done": True,
                    "session_id": session_id,
                    "full_response": emergency_response
                }, ensure_ascii=False)
                yield f"data: {done_data}\n\n"
                return
            
            # ✅ 危急症状拦截 - 语义检测
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
                
                # 分块发送紧急提示
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
            
            # ✅ 正常对话流程 - 真正的流式返回
            full_response = ""
            for chunk in agent.execute_stream(user_input, session_id):
                full_response += chunk
                # 发送每个 chunk
                data = json.dumps({"content": chunk, "done": False}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            
            logger.info(f"会话 {session_id} 流式问答成功，响应长度: {len(full_response)}")
            
            # 发送完成信号
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
            "X-Accel-Buffering": "no"  # 禁用 Nginx 缓冲
        }
    )


