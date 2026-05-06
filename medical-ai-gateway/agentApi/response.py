"""
统一响应格式模块
模仿 Java Spring Boot 的 Result<T> 统一返回结构

提供：
1. 统一状态码定义（ResultCode）
2. 统一消息定义（ResultMessage）
3. 通用响应体（ApiResult）
4. 业务数据模型（ChatData, SessionCreateData等）
"""
from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field
from datetime import datetime


# ==================== 泛型类型变量 ====================
T = TypeVar('T')


# ==================== 统一状态码定义 ====================
class ResultCode:
    """
    统一状态码定义（模仿 Java 枚举）

    状态码规范：
    - 2xx: 成功类
    - 4xx: 客户端错误
    - 5xx: 服务端错误
    """
    SUCCESS = 200                    # 请求成功
    EMERGENCY = 201                  # 危急症状拦截（特殊成功状态）
    CREATED = 201                    # 资源创建成功
    BAD_REQUEST = 400                # 请求参数错误
    UNAUTHORIZED = 401               # 未授权访问
    FORBIDDEN = 403                  # 禁止访问
    NOT_FOUND = 404                  # 资源不存在
    METHOD_NOT_ALLOWED = 405         # 请求方法不允许
    CONFLICT = 409                   # 资源冲突
    INTERNAL_ERROR = 500             # 服务器内部错误
    ERROR = 500                      # 别名，兼容旧代码
    SERVICE_UNAVAILABLE = 503        # 服务不可用


# ==================== 统一消息定义 ====================
class ResultMessage:
    """统一响应消息定义"""
    SUCCESS = "操作成功"
    CREATED = "资源创建成功"
    DELETED = "资源删除成功"
    ERROR = "系统异常，请稍后重试"
    BAD_REQUEST = "请求参数错误"
    UNAUTHORIZED = "未授权访问，请先登录"
    FORBIDDEN = "禁止访问该资源"
    NOT_FOUND = "请求的资源不存在"
    EMERGENCY = "检测到危急症状，请立即就医"
    VALIDATION_ERROR = "数据验证失败"
    SERVICE_ERROR = "服务处理失败"


# ==================== 通用响应体 ====================
class ApiResult(BaseModel, Generic[T]):
    """
    统一 API 响应结构

    对应 Java 的 Result<T> 类
    所有接口都返回此结构，保证前端/调用方处理一致性

    示例响应：
    {
        "code": 200,
        "message": "操作成功",
        "data": {...},
        "timestamp": "2026-05-06T10:30:00"
    }
    """
    code: int = Field(
        default=ResultCode.SUCCESS,
        description="状态码：200成功，201紧急拦截，4xx客户端错误，5xx服务端错误"
    )
    message: str = Field(
        default=ResultMessage.SUCCESS,
        description="响应消息，用于提示操作结果"
    )
    data: Optional[T] = Field(
        default=None,
        description="业务数据载体，具体结构因接口而异"
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="响应时间戳（ISO 8601格式）"
    )

    class Config:
        """Pydantic 配置"""
        json_schema_extra = {
            "example": {
                "code": 200,
                "message": "操作成功",
                "data": {
                    "response": "AI回复内容",
                    "session_id": "550e8400-e29b-41d4-a716-446655440000"
                },
                "timestamp": "2026-05-06T10:30:00.123456"
            }
        }
        from_attributes = True

    @classmethod
    def success(cls, data: T = None, message: str = ResultMessage.SUCCESS) -> "ApiResult[T]":
        """
        成功响应工厂方法

        Args:
            data: 业务数据（可选）
            message: 自定义成功消息（默认：操作成功）

        Returns:
            统一成功响应对象

        使用示例：
            return ApiResult.success(data=user_info, message="查询成功")
        """
        return cls(code=ResultCode.SUCCESS, message=message, data=data)

    @classmethod
    def created(cls, data: T = None, message: str = ResultMessage.CREATED) -> "ApiResult[T]":
        """
        创建成功响应工厂方法

        Args:
            data: 创建的资源数据
            message: 自定义消息（默认：资源创建成功）

        Returns:
            统一创建成功响应对象

        使用示例：
            return ApiResult.created(data=new_session, message="会话创建成功")
        """
        return cls(code=ResultCode.CREATED, message=message, data=data)

    @classmethod
    def error(cls, message: str = ResultMessage.ERROR, code: int = ResultCode.INTERNAL_ERROR, data: T = None) -> "ApiResult[T]":
        """
        失败响应工厂方法

        Args:
            message: 错误消息（默认：系统异常）
            code: 错误状态码（默认：500）
            data: 可选的错误详情数据

        Returns:
            统一失败响应对象

        使用示例：
            return ApiResult.error(message="参数错误", code=400)
            return ApiResult.error(message="数据库异常", code=500, data={"error": str(e)})
        """
        return cls(code=code, message=message, data=data)

    @classmethod
    def emergency(cls, data: T = None, message: str = ResultMessage.EMERGENCY) -> "ApiResult[T]":
        """
        危急症状拦截响应

        Args:
            data: 紧急提示数据
            message: 警告消息（默认：检测到危急症状）

        Returns:
            统一紧急响应对象

        使用示例：
            emergency_data = ChatData(response="请立即就医！", session_id="xxx")
            return ApiResult.emergency(data=emergency_data)
        """
        return cls(code=ResultCode.EMERGENCY, message=message, data=data)

    @classmethod
    def not_found(cls, message: str = ResultMessage.NOT_FOUND) -> "ApiResult[T]":
        """
        资源不存在响应

        Args:
            message: 自定义消息

        Returns:
            统一404响应对象
        """
        return cls(code=ResultCode.NOT_FOUND, message=message, data=None)

    @classmethod
    def bad_request(cls, message: str = ResultMessage.BAD_REQUEST) -> "ApiResult[T]":
        """
        请求参数错误响应

        Args:
            message: 错误描述

        Returns:
            统一400响应对象
        """
        return cls(code=ResultCode.BAD_REQUEST, message=message, data=None)


# ==================== 业务数据模型 ====================

class ChatData(BaseModel):
    """
    智能问答业务数据

    用于 /api/v1/chat/messages 接口的 data 字段
    """
    response: str = Field(..., description="AI回复内容", min_length=1)
    session_id: str = Field(..., description="会话ID，用于关联对话历史")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "根据您的症状，建议您先休息观察...",
                "session_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class SessionListItem(BaseModel):
    """
    会话列表项数据结构
    
    用于会话列表中的单个会话信息
    """
    id: str = Field(..., description="会话ID")
    title: str = Field(default="新对话", description="会话标题")
    createdAt: int = Field(..., description="创建时间戳（秒）")
    updatedAt: int = Field(..., description="最后更新时间戳（秒）")
    messageCount: int = Field(default=0, description="消息数量", ge=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "我头痛怎么办？",
                "createdAt": 1714982400,
                "updatedAt": 1714982400,
                "messageCount": 5
            }
        }


class SessionListData(BaseModel):
    """
    会话列表业务数据
    
    用于 /api/v1/sessions (GET) 接口的 data 字段
    """
    sessions: List[SessionListItem] = Field(default_factory=list, description="活跃会话列表")
    total: int = Field(..., description="会话总数", ge=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "sessions": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title": "我头痛怎么办？",
                        "createdAt": 1714982400,
                        "updatedAt": 1714982400,
                        "messageCount": 5
                    }
                ],
                "total": 1
            }
        }


class MessageItem(BaseModel):
    """
    单条消息数据结构
    
    用于会话历史中的消息项
    """
    role: str = Field(..., description="消息角色：user（用户）或 assistant（AI助手）")
    content: str = Field(..., description="消息内容")
    timestamp: int = Field(..., description="消息时间戳（秒）")
    
    class Config:
        json_schema_extra = {
            "example": {
                "role": "user",
                "content": "我头痛怎么办？",
                "timestamp": 1714982400
            }
        }


class SessionHistoryData(BaseModel):
    """
    会话历史业务数据
    
    用于 /api/v1/sessions/{id}/history 接口的 data 字段
    """
    messages: List[MessageItem] = Field(default_factory=list, description="历史消息列表")
    
    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    {"role": "user", "content": "我头痛", "timestamp": 1714982400},
                    {"role": "assistant", "content": "建议您...", "timestamp": 1714982401}
                ]
            }
        }


class SessionCreateData(BaseModel):
    """
    创建会话业务数据
    
    用于 POST /api/v1/sessions 接口的 data 字段
    """
    id: str = Field(..., description="新创建的会话ID")
    createdAt: int = Field(..., description="创建时间戳（秒）")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "createdAt": 1714982400
            }
        }


class HealthData(BaseModel):
    """
    健康检查业务数据

    用于 /api/v1/health 接口的 data 字段
    """
    service: str = Field(default="医疗AI智能问答系统", description="服务名称")
    version: str = Field(default="1.0.0", description="API版本号")
    redis: str = Field(default="unknown", description="Redis连接状态：connected/disconnected/error")

    class Config:
        json_schema_extra = {
            "example": {
                "service": "医疗AI智能问答系统",
                "version": "1.0.0",
                "redis": "connected"
            }
        }


# ==================== 请求数据模型 ====================

class ChatRequest(BaseModel):
    """
    智能问答请求数据

    用于 POST /api/v1/chat/messages 的请求体
    """
    user_input: str = Field(
        ...,
        description="用户输入的问题",
        min_length=1,
        max_length=2000,
        example="我最近经常头痛，应该怎么办？"
    )
    session_id: str = Field(
        ...,
        description="会话ID，用于关联对话历史",
        example="550e8400-e29b-41d4-a716-446655440000"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_input": "我头痛怎么办？",
                "session_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class SessionDeleteRequest(BaseModel):
    """
    删除会话请求数据（已废弃，直接使用路径参数）

    保留此类仅为兼容性考虑，建议使用 DELETE /api/v1/sessions/{session_id}
    """
    session_id: str = Field(..., description="要删除的会话ID")


# ==================== 辅助工具函数 ====================

def format_error_response(error: Exception, code: int = ResultCode.INTERNAL_ERROR) -> ApiResult:
    """
    格式化异常为统一错误响应

    Args:
        error: 捕获的异常对象
        code: 错误状态码

    Returns:
        统一错误响应对象

    使用示例：
        try:
            # 业务逻辑
            pass
        except Exception as e:
            return format_error_response(e, code=500)
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"系统异常: {str(error)}", exc_info=True)

    return ApiResult.error(
        message=f"系统异常: {str(error)}",
        code=code
    )


def validate_session_id(session_id: str) -> tuple[bool, Optional[ApiResult]]:
    """
    验证会话ID有效性

    Args:
        session_id: 待验证的会话ID

    Returns:
        (是否有效, 错误响应) 元组
        - 如果有效：(True, None)
        - 如果无效：(False, ApiResult错误对象)

    使用示例：
        is_valid, error = validate_session_id(session_id)
        if not is_valid:
            return error
    """
    if not session_id or not session_id.strip():
        return False, ApiResult.bad_request(message="会话ID不能为空")

    return True, None


def validate_user_input(user_input: str) -> tuple[bool, Optional[ApiResult]]:
    """
    验证用户输入有效性

    Args:
        user_input: 待验证的用户输入

    Returns:
        (是否有效, 错误响应) 元组

    使用示例：
        is_valid, error = validate_user_input(user_input)
        if not is_valid:
            return error
    """
    if not user_input or not user_input.strip():
        return False, ApiResult.bad_request(message="用户输入不能为空")

    if len(user_input) > 2000:
        return False, ApiResult.bad_request(message="用户输入不能超过2000字符")

    return True, None