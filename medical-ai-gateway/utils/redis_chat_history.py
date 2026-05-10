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


def build_session_key(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """
    对外暴露统一的会话 Key 生成方法，供其他模块复用，避免重复拼 key 造成不一致。
    """
    return _session_key(session_id, assistant_profile, user_id)


def _trim(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cap = int(redis_conf.get("max_messages", 80))
    if cap <= 0 or len(messages) <= cap:
        return messages
    return messages[-cap:]


def _normalize_session_record(raw: str) -> dict[str, Any]:
    """
    把 Redis 中历史格式（list 或 dict）统一转换为 dict 结构。

    统一结构：
    {
      "title": str,
      "messages": list[{"role":"user|assistant","content":"..."}],
      "created_at": int,
      "updated_at": int,
      "assistant_profile": str|None,
      "user_id": str|None,
      "session_id": str|None,
      ... 其他扩展字段（如 summary/user_profile）
    }
    """
    data = json.loads(raw)
    if isinstance(data, dict):
        out = dict(data)
        if not isinstance(out.get("messages"), list):
            out["messages"] = []
        return out
    if isinstance(data, list):
        return {"title": "新对话", "messages": data}
    return {"title": "新对话", "messages": []}


def get_session_record(
    session_id: str,
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    读取完整会话记录（包含 messages + 扩展元数据）。
    """
    if not session_id:
        return {"title": "新对话", "messages": []}
    try:
        r = get_redis_client()
        key = _session_key(session_id, assistant_profile, user_id)
        raw = r.get(key)
        if not raw and (assistant_profile or user_id):
            key = _session_key(session_id)
            raw = r.get(key)
        if not raw:
            return {"title": "新对话", "messages": []}
        record = _normalize_session_record(raw)
        record.setdefault("title", "新对话")
        record.setdefault("messages", [])
        return record
    except redis.RedisError as e:
        logger.error(f"Redis 读取会话记录失败 session_id={session_id}: {e}")
        return {"title": "新对话", "messages": []}


def save_session_record(
    session_id: str,
    record: dict[str, Any],
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """
    按统一对象结构保存完整会话记录。
    """
    if not session_id:
        return
    try:
        r = get_redis_client()
        key = _session_key(session_id, assistant_profile, user_id)
        ttl = int(redis_conf.get("ttl_seconds", 604800))
        payload = json.dumps(record, ensure_ascii=False)
        if ttl > 0:
            r.setex(key, ttl, payload)
        else:
            r.set(key, payload)
    except redis.RedisError as e:
        logger.error(f"Redis 保存会话记录失败 session_id={session_id}: {e}")


def get_messages(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> list[dict[str, str]]:
    """读取会话历史，格式为 [{"role":"user"|"assistant","content":"..."}, ...]"""
    if not session_id:
        return []
    try:
        record = get_session_record(session_id, assistant_profile, user_id)
        msg_list = record.get("messages", [])
        out: list[dict[str, str]] = []
        for item in msg_list:
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and "content" in item:
                out.append({"role": item["role"], "content": str(item["content"])})
        key = _session_key(session_id, assistant_profile, user_id)
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
        trimmed = _trim(messages)
        existing_data = get_session_record(session_id, assistant_profile, user_id)
        existing_data["messages"] = trimmed
        save_session_record(session_id, existing_data, assistant_profile, user_id)
        key = _session_key(session_id, assistant_profile, user_id)
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
