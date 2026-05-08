"""
总结服务：用户进行提问，搜索参考资料，将提问和参考资料提交给模型。让模型总结回复
支持 Elasticsearch 混合检索（向量 + BM25）
"""
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

from rag.vector_store import VectorStoreService
from utils.prompts_loader import load_rag_prompt
from langchain_core.prompts import PromptTemplate
from model.factory import chat_model
from utils.logger_handler import logger


class RagSummarizationService(object):
    def __init__(self):
        self.vector_store = VectorStoreService()
        self.retriever = self.vector_store.get_retriever()
        self.prompt_text = load_rag_prompt()
        self.prompt_template = PromptTemplate.from_template(self.prompt_text)
        self.model = chat_model
        self.chain = self._init_chain()
    
    # 初始化链
    def _init_chain(self):
        chain = self.prompt_template | self.model | StrOutputParser()
        return chain
    
    # 检索参考资料（使用混合检索）
    def retriever_docs(self, query: str) -> list[Document]:
        """
        检索相关文档
        
        Args:
            query: 查询文本
            
        Returns:
            Document 列表
        """
        docs = self.retriever.invoke(query)
        logger.info(f"📚 检索到 {len(docs)} 条参考文档")
        return docs

    def rag_summarize(self, query: str) -> str:
        """
        基于检索结果生成总结回答
        
        Args:
            query: 用户问题
            
        Returns:
            AI 生成的回答
        """
        docs = self.retriever_docs(query)
        
        if not docs:
            logger.warning("⚠️ 未检索到相关文档，使用通用回答")
            return "抱歉，我暂时没有找到相关的参考资料。建议您咨询专业医生或提供更多详细信息。"
        
        # 构建上下文
        context = ""
        for i, doc in enumerate(docs, 1):
            context += f"<参考资料{i}>: {doc.page_content}\n来源：{doc.metadata.get('filename', '未知')}\n\n"

        # 调用 LLM 生成回答
        try:
            response = self.chain.invoke({"input": query, "context": context})
            logger.info(f"✅ RAG 总结完成，响应长度: {len(response)}")
            return response
        except Exception as e:
            logger.error(f"❌ RAG 总结失败: {e}")
            return f"抱歉，生成回答时出现错误：{str(e)}"


