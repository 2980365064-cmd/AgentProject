"""
按会话 ID 在 Redis 中存储多轮对话（role + content JSON 列表）。
使用字段 _ol_version + Lua CAS 做乐观并发控制，避免同一会话并发写覆盖。
"""
from __future__ import annotations

import json
import os
import random
import time
from typing import Any, Optional, Tuple

import redis

from utils.config_handler import redis_conf
from utils.logger_handler import logger

_client: redis.Redis | None = None

# 乐观锁版本字段（写入 Redis 的 JSON 内）
SESSION_OL_VERSION = "_ol_version"

_SAVE_SESSION_CAS_LUA = """
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local new_json = ARGV[2]
local exp = tonumber(ARGV[3])

local function set_key(val)
  if ttl > 0 then
    redis.call('SETEX', key, ttl, val)
  else
    redis.call('SET', key, val)
  end
end

local cur = redis.call('GET', key)
if cur == false then
  if exp ~= 0 then
    return cjson.encode({ok=0, current=0, reason="missing"})
  end
  local doc = cjson.decode(new_json)
  doc['_ol_version'] = 1
  set_key(cjson.encode(doc))
  return cjson.encode({ok=1, version=1})
end

local doc = cjson.decode(cur)
local cv = doc['_ol_version']
if cv == nil then cv = 0 end
cv = tonumber(cv) or 0
if cv ~= exp then
  return cjson.encode({ok=0, current=cv, reason="version_mismatch"})
end

local newdoc = cjson.decode(new_json)
newdoc['_ol_version'] = cv + 1
set_key(cjson.encode(newdoc))
return cjson.encode({ok=1, version=cv + 1})
"""

_script_save_cas: Any = None


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


def _get_save_cas_script():
    global _script_save_cas
    if _script_save_cas is None:
        _script_save_cas = get_redis_client().register_script(_SAVE_SESSION_CAS_LUA)
    return _script_save_cas


def _session_key(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """
    生成 Redis Key

    新格式：agent:chat:{profile}:{user_id}:{session_id}
    旧格式：agent:chat:{session_id}
    """
    prefix = redis_conf.get("key_prefix", "agent:chat:")

    if assistant_profile and user_id:
        return f"{prefix}{assistant_profile}:{user_id}:{session_id}"
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


def _coerce_version(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _normalize_session_record(raw: str) -> dict[str, Any]:
    """
    把 Redis 中历史格式（list 或 dict）统一转换为 dict 结构。
    """
    data = json.loads(raw)
    if isinstance(data, dict):
        out = dict(data)
        if not isinstance(out.get("messages"), list):
            out["messages"] = []
    elif isinstance(data, list):
        out = {"title": "新对话", "messages": data}
    else:
        out = {"title": "新对话", "messages": []}
    out.setdefault("title", "新对话")
    out[SESSION_OL_VERSION] = _coerce_version(out.get(SESSION_OL_VERSION))
    return out


def _empty_session_virtual() -> dict[str, Any]:
    return {"title": "新对话", "messages": [], SESSION_OL_VERSION: 0}


def _payload_json_without_version(record: dict[str, Any]) -> str:
    payload = {k: v for k, v in record.items() if k != SESSION_OL_VERSION}
    return json.dumps(payload, ensure_ascii=False)


def try_save_session_record_cas(
    session_id: str,
    record: dict[str, Any],
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
    *,
    expected_version: int,
    ttl_seconds: Optional[int] = None,
) -> Tuple[bool, int]:
    """
    原子 CAS 写入会话 JSON。
    返回 (ok, version)：成功时 version 为新的 _ol_version；失败时 version 为 Redis 中当前版本（用于重试读改写）。
    """
    if not session_id:
        return False, 0
    if ttl_seconds is None:
        ttl_seconds = int(redis_conf.get("ttl_seconds", 604800))
    try:
        r = get_redis_client()
        key = _session_key(session_id, assistant_profile, user_id)
        script = _get_save_cas_script()
        raw = script(keys=[key], args=[ttl_seconds, _payload_json_without_version(record), int(expected_version)])
        if isinstance(raw, bytes):
            raw = raw.decode()
        data = json.loads(raw)
        if data.get("ok"):
            return True, int(data.get("version", 0))
        return False, int(data.get("current", 0))
    except redis.RedisError as e:
        logger.error(f"Redis CAS 保存会话失败 session_id={session_id}: {e}")
        return False, expected_version


def get_session_record(
    session_id: str,
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    读取完整会话记录（包含 messages + 扩展元数据）。
    """
    if not session_id:
        return _empty_session_virtual()
    try:
        r = get_redis_client()
        key = _session_key(session_id, assistant_profile, user_id)
        raw = r.get(key)
        if not raw and (assistant_profile or user_id):
            key = _session_key(session_id)
            raw = r.get(key)
        if not raw:
            return _empty_session_virtual()
        record = _normalize_session_record(raw)
        record.setdefault("title", "新对话")
        record.setdefault("messages", [])
        return record
    except redis.RedisError as e:
        logger.error(f"Redis 读取会话记录失败 session_id={session_id}: {e}")
        return _empty_session_virtual()


def save_session_record(
    session_id: str,
    record: dict[str, Any],
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """
    单次 CAS 写入（无重试）。冲突时仅记录错误；业务侧请使用带重试的路径或 try_save_session_record_cas。
    """
    ev = _coerce_version(record.get(SESSION_OL_VERSION))
    ok, cur = try_save_session_record_cas(
        session_id,
        record,
        assistant_profile,
        user_id,
        expected_version=ev,
        ttl_seconds=int(redis_conf.get("ttl_seconds", 604800)),
    )
    if not ok:
        logger.error(
            f"save_session_record CAS 失败 session_id={session_id} expected={ev} current={cur}"
        )


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

        if not exists and (assistant_profile or user_id):
            old_key = _session_key(session_id)
            exists = bool(get_redis_client().exists(old_key))

        return exists
    except redis.RedisError as e:
        logger.error(f"Redis 检查会话是否存在失败 session_id={session_id}: {e}")
        return False


def save_messages(
    session_id: str,
    messages: list[dict[str, str]],
    assistant_profile: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    if not session_id:
        return
    ttl = int(redis_conf.get("ttl_seconds", 604800))
    try:
        trimmed = _trim(messages)
        for attempt in range(16):
            existing_data = get_session_record(session_id, assistant_profile, user_id)
            existing_data["messages"] = trimmed
            ev = _coerce_version(existing_data.get(SESSION_OL_VERSION))
            ok, _ = try_save_session_record_cas(
                session_id,
                existing_data,
                assistant_profile,
                user_id,
                expected_version=ev,
                ttl_seconds=ttl,
            )
            if ok:
                key = _session_key(session_id, assistant_profile, user_id)
                logger.info(f"✅ 保存 {len(trimmed)} 条消息到 Key={key}")
                return
            time.sleep(0.005 * (attempt + 1) + random.random() * 0.002)
        logger.error(f"save_messages CAS 重试耗尽 session_id={session_id}")
    except redis.RedisError as e:
        logger.error(f"Redis 写入会话历史失败 session_id={session_id}: {e}")


def clear_session(session_id: str, assistant_profile: Optional[str] = None, user_id: Optional[str] = None) -> None:
    if not session_id:
        return
    try:
        key = _session_key(session_id, assistant_profile, user_id)
        get_redis_client().delete(key)

        if assistant_profile or user_id:
            old_key = _session_key(session_id)
            get_redis_client().delete(old_key)

        logger.info(f"✅ 清除会话: {session_id}")
    except redis.RedisError as e:
        logger.error(f"Redis 清除会话失败 session_id={session_id}: {e}")
