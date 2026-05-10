import os
from collections import defaultdict
from dataclasses import dataclass
from hashlib import md5
from typing import Dict, List, Tuple

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk

from model.factory import embedding_model
from utils.config_handler import es_conf
from utils.logger_handler import logger


@dataclass(frozen=True)
class IntentSeed:
    action: str
    utterance: str


class IntentVectorStore:
    """ES 向量意图库：用于低成本意图预路由。"""

    def __init__(self):
        es_host = os.environ.get("ES_HOST", es_conf.get("es_host", "localhost"))
        es_port = int(os.environ.get("ES_PORT", str(es_conf.get("es_port", 9200))))
        es_user = es_conf.get("es_user", "elastic")
        es_password = es_conf.get("es_password", "")

        if es_password:
            self.es_client = Elasticsearch(
                hosts=[f"http://{es_host}:{es_port}"],
                basic_auth=(es_user, es_password),
            )
        else:
            self.es_client = Elasticsearch(hosts=[f"http://{es_host}:{es_port}"])

        self.index_name = os.environ.get("INTENT_ES_INDEX", "agent_intent_router")
        self.vector_field = "embedding"
        self.text_field = "utterance"
        self.action_field = "intent_action"
        self.text_analyzer = os.environ.get(
            "INTENT_TEXT_ANALYZER", es_conf.get("text_analyzer", "standard")
        )
        self.vector_weight = float(os.environ.get("INTENT_VECTOR_WEIGHT", "0.8"))
        self.bm25_weight = float(os.environ.get("INTENT_BM25_WEIGHT", "0.2"))
        self.vector_dims = len(embedding_model.embed_query("intent_dimension_probe"))

        self._ensure_index()

    def _ensure_index(self):
        if self.es_client.indices.exists(index=self.index_name):
            logger.info(f"意图库索引已存在: {self.index_name}")
            return

        body = {
            "mappings": {
                "properties": {
                    self.vector_field: {
                        "type": "dense_vector",
                        "dims": self.vector_dims,
                        "index": True,
                        "similarity": "cosine",
                    },
                    self.text_field: {
                        "type": "text",
                        "analyzer": self.text_analyzer,
                    },
                    self.action_field: {"type": "keyword"},
                }
            },
            "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        }
        self.es_client.indices.create(index=self.index_name, body=body)
        logger.info(f"已创建意图库索引: {self.index_name}")

    @staticmethod
    def default_seeds() -> List[IntentSeed]:
        return [
            IntentSeed("book_appointment", "我要预约挂号"),
            IntentSeed("book_appointment", "帮我挂号，约个医生看诊"),
            IntentSeed("book_appointment", "我想预约明天门诊"),
            IntentSeed("book_appointment", "给我预约骨科医生"),
            IntentSeed("cancel_appointment", "我要取消预约挂号"),
            IntentSeed("cancel_appointment", "退号，不去看了"),
            IntentSeed("get_doctor_info", "医生什么时候坐诊"),
            IntentSeed("get_doctor_info", "查询医生信息和排班"),
            IntentSeed("get_doctor_info", "我骨折了，帮我推荐合适的医生"),
            IntentSeed("get_doctor_info", "帮我查询一下适合的医生"),
            IntentSeed("get_doctor_info", "我这个症状应该看哪个医生"),
            IntentSeed("get_doctor_info", "请给我推荐一个医生"),
        ]

    def bootstrap(self, seeds: List[IntentSeed]):
        actions = []
        for seed in seeds:
            doc_id = md5(f"{seed.action}:{seed.utterance}".encode("utf-8")).hexdigest()
            embedding = embedding_model.embed_query(seed.utterance)
            actions.append(
                {
                    "_op_type": "index",
                    "_index": self.index_name,
                    "_id": doc_id,
                    "_source": {
                        self.action_field: seed.action,
                        self.text_field: seed.utterance,
                        self.vector_field: embedding,
                    },
                }
            )
        if actions:
            bulk(self.es_client, actions, refresh="wait_for")
            logger.info("意图种子已写入/更新")

    def search_actions(self, query: str, top_k: int = 5) -> List[Tuple[str, float]]:
        query_embedding = embedding_model.embed_query(query)
        
        # 使用 KNN 向量检索，返回原始向量相似度
        body = {
            "size": top_k * 2,
            "query": {
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": (
                            f"cosineSimilarity(params.query_vector, '{self.vector_field}') + 1.0"
                        ),
                        "params": {"query_vector": query_embedding},
                    },
                },
            },
            "_source": [self.action_field, self.text_field],
        }
        response = self.es_client.search(index=self.index_name, body=body)
        hits = response.get("hits", {}).get("hits", [])

        grouped: Dict[str, float] = defaultdict(float)
        for hit in hits:
            source = hit.get("_source", {})
            action = source.get(self.action_field)
            if not action:
                continue
            grouped[action] = max(grouped[action], float(hit.get("_score", 0.0)))

        return sorted(grouped.items(), key=lambda x: x[1], reverse=True)


_intent_store: IntentVectorStore | None = None


def get_intent_store() -> IntentVectorStore:
    global _intent_store
    if _intent_store is None:
        _intent_store = IntentVectorStore()
    return _intent_store


def initialize_intent_library():
    store = get_intent_store()
    store.bootstrap(store.default_seeds())