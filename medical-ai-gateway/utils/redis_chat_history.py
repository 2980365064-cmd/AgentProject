"""
按会话 ID 在 Redis 中存储多轮对话（role + content JSON 列表）。
"""
from __future__ import annotations
import json
import os
from typing import Any
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


def _session_key(session_id: str) -> str:
    prefix = redis_conf.get("key_prefix", "agent:chat:")
    return f"{prefix}{session_id}"


def _trim(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cap = int(redis_conf.get("max_messages", 80))
    if cap <= 0 or len(messages) <= cap:
        return messages
    return messages[-cap:]


def get_messages(session_id: str) -> list[dict[str, str]]:
    """读取会话历史，格式为 [{"role":"user"|"assistant","content":"..."}, ...]"""
    if not session_id:
        return []
    try:
        r = get_redis_client()
        raw = r.get(_session_key(session_id))
        if not raw:
            return []
        data = json.loads(raw)

        #安全检查，防止数据格式错误
        if not isinstance(data, list):
            return []
        out: list[dict[str, str]] = []
        for item in data:
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and "content" in item:
                out.append({"role": item["role"], "content": str(item["content"])})
        return out
    except redis.RedisError as e:
        logger.error(f"Redis 读取会话历史失败 session_id={session_id}: {e}")
        return []


def save_messages(session_id: str, messages: list[dict[str, str]]) -> None:
    if not session_id:
        return
    try:
        r = get_redis_client()
        trimmed = _trim(messages)
        ttl = int(redis_conf.get("ttl_seconds", 604800))
        key = _session_key(session_id)
        payload = json.dumps(trimmed, ensure_ascii=False)
        if ttl > 0:
            r.setex(key, ttl, payload)
        else:
            r.set(key, payload)
    except redis.RedisError as e:
        logger.error(f"Redis 写入会话历史失败 session_id={session_id}: {e}")


def clear_session(session_id: str) -> None:
    if not session_id:
        return
    try:
        get_redis_client().delete(_session_key(session_id))
    except redis.RedisError as e:
        logger.error(f"Redis 清除会话失败 session_id={session_id}: {e}")
