"""
总结服务：用户进行提问，搜索参考资料，将提问和参考资料提交给模型。让模型总结回复
"""
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

from rag.vector_store import VectorStoreService
from utils.prompts_loader import load_rag_prompt
from langchain_core.prompts import PromptTemplate
from model.factory import chat_model
class RagSummarizationService(object):
    def __init__(self):
        self.vector_store = VectorStoreService ()
        self.retriever=self.vector_store.get_retriever()
        self.prompt_text=load_rag_prompt()
        self.prompt_template=PromptTemplate.from_template(self.prompt_text)
        self.model=chat_model
        self.chain=self._init_chain()
    # 初始化链
    def _init_chain(self):
        chain=self.prompt_template|self.model|StrOutputParser ()
        return chain
    # 检索参考资料
    def retriever_docs(self,query:str) ->list[ Document]:
        return self.retriever.invoke(query)

    def rag_summarize(self,query:str) ->str:
        docs=self.retriever_docs(query)
        context=""
        counter=0
        for doc in docs:
            counter+=1
            context+=f"<参考资料{counter}>:doc.page_content|参考源数据：{doc.metadata}"

        return self.chain.invoke({"input":query,"context":context})


