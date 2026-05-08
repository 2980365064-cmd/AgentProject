import os

from langchain_core.documents import Document
from rag.elasticsearchVectorStore import ElasticsearchVectorStore
from utils.config_handler import es_conf
from utils.file_handler import get_file_md5_hex, listdir_with_allowed_types, pdf_loader, text_loader
from utils.logger_handler import logger
from utils.path_tool import get_abs_path


# 矢量数据库服务（基于 Elasticsearch）
class VectorStoreService:
    def __init__(self):
        self.vector_store = ElasticsearchVectorStore()

    # 返回一个检索器（使用混合检索）
    def get_retriever(self):
        """
        返回检索器对象
        
        Returns:
            具有 invoke 方法的检索器，支持混合检索
        """
        class HybridRetriever:
            def __init__(self, store: ElasticsearchVectorStore):
                self.store = store
            
            def invoke(self, query: str, k: int = None):
                """执行混合检索"""
                return self.store.hybrid_search(query, k)
        
        return HybridRetriever(self.vector_store)

    def load_document(self):
        """
        从数据文件中读取数据，转为向量存入向量库
        计算文件的MD5并去重
        """
        # 检查文件MD5
        def check_md5_hex(md5_for_check: str):
            md5_file = get_abs_path(es_conf["md5_hex_store"])
            if not os.path.exists(md5_file):
                # 创建文件
                open(md5_file, "w", encoding="utf-8").close()
                return False  # md5未处理过

            with open(md5_file, "r", encoding="utf-8") as f:
                for line in f.readlines():
                    line = line.strip()
                    if line == md5_for_check:
                        return True  # 文件已处理过

            return False  # 文件未处理过

        def save_md5_hex(md5_for_save: str):
            md5_file = get_abs_path(es_conf["md5_hex_store"])
            with open(md5_file, "a", encoding="utf-8") as f:
                f.write(md5_for_save + "\n")

        def get_file_documents(read_path: str):
            if read_path.endswith("txt"):
                return text_loader(read_path)

            if read_path.endswith("pdf"):
                return pdf_loader(read_path)

            return []

        allowed_file_path: list[str] = listdir_with_allowed_types(
            get_abs_path(es_conf["data_path"]),
            tuple(es_conf["allow_knowledge_file_type"])
        )
        
        for path in allowed_file_path:
            md5_hex = get_file_md5_hex(path)
            if not md5_hex:
                continue
            if check_md5_hex(md5_hex):
                logger.info(f"文件{path}已处理过")
                continue

            try:
                documents: list[Document] = get_file_documents(path)

                if not documents:
                    logger.warning(f"文件{path}为空,跳过")
                    continue
                
                split_document: list[Document] = self.vector_store.splitter.split_documents(documents)

                if not split_document:
                    logger.warning(f"文件{path}分块为空,跳过")
                    continue
                
                # 存入 Elasticsearch 向量库
                self.vector_store.add_documents(split_document)
                
                # 保存文件MD5
                save_md5_hex(md5_hex)
                logger.info(f"文件{path}处理完毕")

            except Exception as e:
                logger.error(f"处理文件{path}失败,{str(e)}")

    def ingest_admin_file(self, file_path: str, original_filename: str, ingest_source_key: str) -> int:
        """
        管理端上传合并后的文件：解析、分块、写入 ES（source 带统一前缀便于删除）
        """
        lower = (original_filename or "").lower()
        if not lower.endswith((".pdf", ".txt")):
            raise ValueError("仅支持 pdf / txt 知识文件")

        if lower.endswith(".pdf"):
            documents: list[Document] = pdf_loader(file_path)
        else:
            documents = text_loader(file_path)

        if not documents:
            raise ValueError("文档为空或无法解析")

        split_document: list[Document] = self.vector_store.splitter.split_documents(documents)
        if not split_document:
            raise ValueError("分块后为空")

        for j, d in enumerate(split_document):
            base = f"{ingest_source_key}{original_filename}"
            d.metadata["source"] = f"{base}#part-{j}"
            d.metadata["filename"] = original_filename
            d.metadata["doc_id"] = f"{ingest_source_key}{j}"
            d.metadata.setdefault("page", 0)

        self.vector_store.add_documents(split_document)
        logger.info(f"✅ 管理端入库完成: {original_filename}, 块数={len(split_document)}")
        return len(split_document)

