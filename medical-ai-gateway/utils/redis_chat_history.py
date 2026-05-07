"""
按会话 ID 在 Redis 中存储多轮对话（role + content JSON 列表）。
"""
from __future__ import annotations
import json
import os
from typing import Any, Optional
import redis
from utils.config_handler import redis_conf
from utils.logger_handler import logger

_client: redis.Redis | None = None


def _build_client() -> redis.Redis:
    pwd = redis_conf.get("password") or os.environ.get("REDIS_PASSWORD") or None
    if pwd == "":
        pwd = None
    url = os.environ.get("REDIS_URL")
    if url:
        return redis.from_url(url, decode_responses=True)
    return redis.Redis(
        host=redis_conf["host"],
        port=int(redis_conf["port"]),
        db=int(redis_conf["db"]),
        password=pwd,
        decode_responses=True,
    )


def get_redis_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def _session_key(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """
    生成 Redis Key
    
    新格式：agent:chat:{profile}:{user_id}:{session_id}
    旧格式：agent:chat:{session_id}
    """
    prefix = redis_conf.get("key_prefix", "agent:chat:")
    
    if assistant_profile and user_id:
        # 新格式
        return f"{prefix}{assistant_profile}:{user_id}:{session_id}"
    else:
        # 旧格式（向后兼容）
        return f"{prefix}{session_id}"


def _trim(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cap = int(redis_conf.get("max_messages", 80))
    if cap <= 0 or len(messages) <= cap:
        return messages
    return messages[-cap:]


def get_messages(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> list[dict[str, str]]:
    """读取会话历史，格式为 [{"role":"user"|"assistant","content":"..."}, ...]"""
    if not session_id:
        return []
    try:
        r = get_redis_client()
        
        # ✅ 尝试新格式
        key = _session_key(session_id, assistant_profile, user_id)
        raw = r.get(key)
        
        # ✅ 如果新格式找不到，尝试旧格式
        if not raw and (assistant_profile or user_id):
            logger.info(f"新格式 Key 未找到数据，尝试旧格式: {session_id}")
            key = _session_key(session_id)
            raw = r.get(key)
        
        if not raw:
            logger.warning(f"会话 {session_id} 在 Redis 中不存在")
            return []
        
        data = json.loads(raw)

        # 新格式：{"title": "...", "messages": [...]}；旧格式：直接为消息数组
        if isinstance(data, dict):
            msg_list = data.get("messages")
            if not isinstance(msg_list, list):
                return []
        elif isinstance(data, list):
            msg_list = data
        else:
            return []

        out: list[dict[str, str]] = []
        for item in msg_list:
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and "content" in item:
                out.append({"role": item["role"], "content": str(item["content"])})
        
        logger.info(f"✅ 从 Key={key} 读取到 {len(out)} 条消息")
        return out
    except redis.RedisError as e:
        logger.error(f"Redis 读取会话历史失败 session_id={session_id}: {e}")
        return []


def session_exists(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> bool:
    """Redis 中是否存在该会话 key（含仅有标题、尚无消息的新会话）"""
    if not session_id:
        return False
    try:
        key = _session_key(session_id, assistant_profile, user_id)
        exists = bool(get_redis_client().exists(key))
        
        # ✅ 如果新格式不存在，尝试旧格式
        if not exists and (assistant_profile or user_id):
            old_key = _session_key(session_id)
            exists = bool(get_redis_client().exists(old_key))
        
        return exists
    except redis.RedisError as e:
        logger.error(f"Redis 检查会话是否存在失败 session_id={session_id}: {e}")
        return False


def save_messages(session_id: str, messages: list[dict[str, str]], 
                 assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> None:
    if not session_id:
        return
    try:
        r = get_redis_client()
        trimmed = _trim(messages)
        ttl = int(redis_conf.get("ttl_seconds", 604800))
        
        # ✅ 使用新格式 Key
        key = _session_key(session_id, assistant_profile, user_id)
        
        # ✅ 检查是否是新格式（包含title的对象）
        raw = r.get(key)
        if raw:
            try:
                existing_data = json.loads(raw)
                if isinstance(existing_data, dict):
                    # 新格式：更新 messages 字段，保留 title
                    existing_data["messages"] = trimmed
                    payload = json.dumps(existing_data, ensure_ascii=False)
                else:
                    # 旧格式：直接是数组
                    payload = json.dumps(trimmed, ensure_ascii=False)
            except:
                payload = json.dumps(trimmed, ensure_ascii=False)
        else:
            # 新会话：直接存储数组
            payload = json.dumps(trimmed, ensure_ascii=False)
        
        if ttl > 0:
            r.setex(key, ttl, payload)
        else:
            r.set(key, payload)
        
        logger.info(f"✅ 保存 {len(trimmed)} 条消息到 Key={key}")
    except redis.RedisError as e:
        logger.error(f"Redis 写入会话历史失败 session_id={session_id}: {e}")


def clear_session(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> None:
    if not session_id:
        return
    try:
        key = _session_key(session_id, assistant_profile, user_id)
        get_redis_client().delete(key)
        
        # ✅ 也删除旧格式的 Key（如果存在）
        if assistant_profile or user_id:
            old_key = _session_key(session_id)
            get_redis_client().delete(old_key)
        
        logger.info(f"✅ 清除会话: {session_id}")
    except redis.RedisError as e:
        logger.error(f"Redis 清除会话失败 session_id={session_id}: {e}")
