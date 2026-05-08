"""
Elasticsearch 向量数据库服务
支持向量检索 + BM25 关键词检索的混合检索模式
"""
import os
from typing import List, Optional
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from elasticsearch.helpers import BulkIndexError
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from model.factory import embedding_model
from utils.config_handler import es_conf
from utils.file_handler import get_file_md5_hex, listdir_with_allowed_types, pdf_loader, text_loader
from utils.logger_handler import logger
from utils.path_tool import get_abs_path


class ElasticsearchVectorStore:
    """Elasticsearch 向量存储服务"""

    def __init__(self):
        # 初始化 Elasticsearch 客户端（可用环境变量覆盖，便于 Docker / K8s）
        es_host = os.environ.get("ES_HOST", es_conf.get("es_host", "localhost"))
        es_port = int(os.environ.get("ES_PORT", str(es_conf.get("es_port", 9200))))
        es_user = es_conf.get("es_user", "elastic")
        es_password = es_conf.get("es_password", "")

        if es_password:
            self.es_client = Elasticsearch(
                hosts=[f"http://{es_host}:{es_port}"],
                basic_auth=(es_user, es_password)
            )
        else:
            self.es_client = Elasticsearch(
                hosts=[f"http://{es_host}:{es_port}"]
            )

        self.index_name = es_conf.get("es_index_name", "medical_knowledge")
        self.vector_field = es_conf.get("vector_field", "embedding")
        self.text_field = es_conf.get("text_field", "content")
        # 未装 IK 插件时不要使用 ik_max_word，否则建索引会报 mapper_parsing_exception
        self.text_analyzer = os.environ.get(
            "ES_TEXT_ANALYZER", es_conf.get("text_analyzer", "standard")
        )
        # 向量维度优先读配置；未配置则从当前嵌入模型探测，避免维度不匹配导致 bulk 写入失败
        self.vector_dims = es_conf.get("vector_dims")
        if not self.vector_dims:
            probe = embedding_model.embed_query("dimension_probe")
            self.vector_dims = len(probe)
        self.k = es_conf.get("k", 5)

        # 混合检索权重
        self.vector_weight = es_conf.get("vector_weight", 0.7)
        self.bm25_weight = es_conf.get("bm25_weight", 0.3)

        # 文本分割器
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=es_conf.get("chunk_size", 200),
            chunk_overlap=es_conf.get("chunk_overlap", 20),
            separators=es_conf.get("separators", ["\n\n", "\n", "。", "！", "？", "；", " "]),
            length_function=len
        )

        # 创建索引（如果不存在）
        self._create_index_if_not_exists()

        logger.info(f"✅ Elasticsearch 向量存储服务初始化完成 (索引: {self.index_name})")

    def _create_index_if_not_exists(self):
        """创建 Elasticsearch 索引（包含向量字段和文本字段）"""
        if self.es_client.indices.exists(index=self.index_name):
            mapping = self.es_client.indices.get_mapping(index=self.index_name)
            dims = (
                mapping.get(self.index_name, {})
                .get("mappings", {})
                .get("properties", {})
                .get(self.vector_field, {})
                .get("dims")
            )
            if dims and int(dims) != int(self.vector_dims):
                raise RuntimeError(
                    f"索引 {self.index_name} 向量维度为 {dims}，当前模型维度为 {self.vector_dims}。"
                    f"请删除索引后重建，或将 config/elasticsearch.yaml 的 vector_dims 调整为 {dims}。"
                )
            logger.info(f"索引 {self.index_name} 已存在")
            return

        index_mapping = {
            "mappings": {
                "properties": {
                    # 向量字段（用于语义检索）
                    self.vector_field: {
                        "type": "dense_vector",
                        "dims": self.vector_dims,
                        "index": True,
                        "similarity": "cosine"  # 余弦相似度
                    },
                    # 文本字段（用于 BM25 关键词检索）
                    self.text_field: {
                        "type": "text",
                        "analyzer": self.text_analyzer,
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256
                            }
                        }
                    },
                    # 元数据字段
                    "source": {
                        "type": "keyword"
                    },
                    "page": {
                        "type": "integer"
                    },
                    "filename": {
                        "type": "keyword"
                    },
                    "doc_id": {
                        "type": "keyword"
                    }
                }
            },
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        }

        try:
            self.es_client.indices.create(index=self.index_name, body=index_mapping)
            logger.info(f"✅ 创建索引 {self.index_name} 成功")
        except Exception as e:
            logger.error(f"❌ 创建索引失败: {e}")
            raise

    def add_documents(self, documents: List[Document]):
        """
        批量添加文档到 Elasticsearch

        Args:
            documents: LangChain Document 列表
        """
        if not documents:
            logger.warning("⚠️ 文档列表为空，跳过入库")
            return

        actions = []
        for i, doc in enumerate(documents):
            try:
                # 生成向量嵌入
                embedding = embedding_model.embed_query(doc.page_content)

                # 构建文档
                action = {
                    "_index": self.index_name,
                    "_id": f"doc_{i}_{hash(doc.page_content)}",  # 基于内容生成唯一 ID
                    "_source": {
                        self.vector_field: embedding,
                        self.text_field: doc.page_content,
                        "source": doc.metadata.get("source", ""),
                        "page": doc.metadata.get("page", 0),
                        "filename": doc.metadata.get("filename", ""),
                        "doc_id": doc.metadata.get("doc_id", "")
                    }
                }
                actions.append(action)
            except Exception as e:
                logger.error(f"处理文档失败: {e}")
                continue

        if actions:
            try:
                success, errors = bulk(self.es_client, actions)
                logger.info(f"✅ 成功入库 {success} 个文档片段")
                if errors:
                    logger.warning(f"⚠️ 入库错误: {errors}")
            except BulkIndexError as e:
                first = e.errors[0] if e.errors else {}
                logger.error(f"❌ 批量入库失败（BulkIndexError）: {first}")
                raise
            except Exception as e:
                logger.error(f"❌ 批量入库失败: {e}")
                raise

    def hybrid_search(self, query: str, k: int = None) -> List[Document]:
        """
        混合检索：向量相似度 + BM25 关键词

        Args:
            query: 查询文本
            k: 返回结果数量

        Returns:
            LangChain Document 列表
        """
        if k is None:
            k = self.k

        try:
            # 生成查询向量
            query_embedding = embedding_model.embed_query(query)

            # 构建混合检索查询
            search_body = {
                "size": k,
                "query": {
                    "script_score": {
                        "query": {
                            "bool": {
                                "should": [
                                    # BM25 关键词匹配
                                    {
                                        "match": {
                                            self.text_field: {
                                                "query": query,
                                                "boost": self.bm25_weight
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        "script": {
                            "source": f"""
                                double vector_score = cosineSimilarity(params.query_vector, '{self.vector_field}') + 1.0;
                                double bm25_score = _score;
                                return vector_score * {self.vector_weight} + bm25_score * {self.bm25_weight};
                            """,
                            "params": {
                                "query_vector": query_embedding
                            }
                        }
                    }
                },
                "_source": [self.text_field, "source", "page", "filename", "doc_id"]
            }

            # 执行检索
            response = self.es_client.search(
                index=self.index_name,
                body=search_body
            )

            # 转换为 LangChain Document 格式
            results = []
            for hit in response["hits"]["hits"]:
                source = hit["_source"]
                doc = Document(
                    page_content=source.get(self.text_field, ""),
                    metadata={
                        "source": source.get("source", ""),
                        "page": source.get("page", 0),
                        "filename": source.get("filename", ""),
                        "doc_id": source.get("doc_id", ""),
                        "score": hit["_score"]
                    }
                )
                results.append(doc)

            logger.info(f"🔍 混合检索返回 {len(results)} 条结果")
            return results

        except Exception as e:
            logger.error(f"❌ 混合检索失败: {e}")
            return []

    def vector_only_search(self, query: str, k: int = None) -> List[Document]:
        """纯向量检索（不使用 BM25）"""
        if k is None:
            k = self.k

        try:
            query_embedding = embedding_model.embed_query(query)

            search_body = {
                "size": k,
                "query": {
                    "script_score": {
                        "query": {"match_all": {}},
                        "script": {
                            "source": f"cosineSimilarity(params.query_vector, '{self.vector_field}') + 1.0",
                            "params": {
                                "query_vector": query_embedding
                            }
                        }
                    }
                },
                "_source": [self.text_field, "source", "page", "filename", "doc_id"]
            }

            response = self.es_client.search(index=self.index_name, body=search_body)

            results = []
            for hit in response["hits"]["hits"]:
                source = hit["_source"]
                doc = Document(
                    page_content=source.get(self.text_field, ""),
                    metadata={
                        "source": source.get("source", ""),
                        "page": source.get("page", 0),
                        "filename": source.get("filename", ""),
                        "doc_id": source.get("doc_id", ""),
                        "score": hit["_score"]
                    }
                )
                results.append(doc)

            return results

        except Exception as e:
            logger.error(f"❌ 向量检索失败: {e}")
            return []

    def keyword_only_search(self, query: str, k: int = None) -> List[Document]:
        """纯关键词检索（BM25）"""
        if k is None:
            k = self.k

        try:
            search_body = {
                "size": k,
                "query": {
                    "match": {
                        self.text_field: query
                    }
                },
                "_source": [self.text_field, "source", "page", "filename", "doc_id"]
            }

            response = self.es_client.search(index=self.index_name, body=search_body)

            results = []
            for hit in response["hits"]["hits"]:
                source = hit["_source"]
                doc = Document(
                    page_content=source.get(self.text_field, ""),
                    metadata={
                        "source": source.get("source", ""),
                        "page": source.get("page", 0),
                        "filename": source.get("filename", ""),
                        "doc_id": source.get("doc_id", ""),
                        "score": hit["_score"]
                    }
                )
                results.append(doc)

            return results

        except Exception as e:
            logger.error(f"❌ 关键词检索失败: {e}")
            return []

    def delete_index(self):
        """删除索引（慎用！）"""
        if self.es_client.indices.exists(index=self.index_name):
            self.es_client.indices.delete(index=self.index_name)
            logger.info(f"🗑️ 已删除索引 {self.index_name}")

    def get_document_count(self) -> int:
        """获取文档总数"""
        try:
            response = self.es_client.count(index=self.index_name)
            return response["count"]
        except Exception as e:
            logger.error(f"❌ 获取文档数量失败: {e}")
            return 0

    def delete_by_source_prefix(self, source_prefix: str) -> int:
        """按 metadata.source 前缀删除向量（管理端删除知识库文件时使用）"""
        if not source_prefix:
            return 0
        try:
            resp = self.es_client.delete_by_query(
                index=self.index_name,
                query={"prefix": {"source": source_prefix}},
                refresh=True,
                conflicts="proceed",
            )
            deleted = int(resp.get("deleted", 0))
            logger.info(f"🗑️ 按前缀删除 ES 文档: prefix={source_prefix!r}, deleted={deleted}")
            return deleted
        except Exception as e:
            logger.error(f"❌ delete_by_source_prefix 失败: {e}")
            raise