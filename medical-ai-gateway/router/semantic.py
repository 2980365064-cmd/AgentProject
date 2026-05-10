from dataclasses import dataclass
from typing import List, Tuple

from intent_manager import get_intent_store
from utils.logger_handler import logger


@dataclass
class RouterDecision:
    action: str
    confidence: float
    candidates: List[Tuple[str, float]]

    @property
    def fallback(self) -> bool:
        return self.action == "FALLBACK_TO_LLM"


def semantic_router(user_query: str, threshold: float = 0.30) -> RouterDecision:
    """
    意图路由拦截器（高优先级于 LLM）。
    使用绝对分数阈值，因为向量相似度范围是 0~2（cosine + 1）
    """
    try:
        ranked = get_intent_store().search_actions(user_query, top_k=5)
        if not ranked:
            return RouterDecision("FALLBACK_TO_LLM", 0.0, [])

        top_action, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0
        
        # 改进的置信度计算：
        # 1. 向量相似度范围是 0~2，1.0 表示中性
        # 2. 使用绝对分数减去中性点，再归一化
        absolute_confidence = (top_score - 1.0) / 1.0  # 假设 1.0 是基线
        absolute_confidence = max(0.0, min(1.0, absolute_confidence))
        
        # 3. 结合相对分差（但权重降低）
        relative_confidence = (top_score - second_score) / max(top_score, 1e-6)
        
        # 4. 最终置信度：70% 绝对分数 + 30% 相对分差
        confidence = 0.7 * absolute_confidence + 0.3 * relative_confidence
        confidence = max(0.0, min(1.0, confidence))

        logger.info(
            f"[Router] query={user_query!r} top={top_action} score={top_score:.4f} "
            f"second={second_score:.4f} confidence={confidence:.4f}"
        )

        if confidence >= threshold:
            return RouterDecision(top_action, confidence, ranked)
        return RouterDecision("FALLBACK_TO_LLM", confidence, ranked)
    except Exception as e:
        logger.error(f"[Router] semantic_router error: {e}", exc_info=True)
        return RouterDecision("FALLBACK_TO_LLM", 0.0, [])