
from abc import ABC, abstractmethod
from typing import  Optional
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from utils.config_handler import agent_conf


#模型的共同抽象方法
class BaseModelFactory(ABC):
   @abstractmethod
   def generator(self) ->Optional[Embeddings|BaseChatModel]:
        pass
#主聊天模型工厂
class MainChatModelFactory(BaseModelFactory):
    def generator(self) ->Optional[Embeddings|BaseChatModel]:
        return ChatOpenAI(
            model=agent_conf["main_chat_model_name"],
            base_url=agent_conf["main_chat_model_base_url"],
            api_key=agent_conf["main_chat_model_api_key"],
            request_timeout =3.0,
            max_retries=0
        )

#备用聊天模型工厂
class BackupChatModelFactory(BaseModelFactory):
    def generator(self) ->Optional[Embeddings|BaseChatModel]:
        return ChatOpenAI(
            model=agent_conf["backup_chat_model_name"],
            base_url=agent_conf["backup_chat_model_base_url"],
            api_key=agent_conf["backup_chat_model_api_key"],
        )


#嵌入模型工厂
class EmbeddingModelFactory(BaseModelFactory):
    def generator(self) ->Optional[Embeddings|BaseChatModel]:
        import os
        api_key = agent_conf.get("embedding_model_api_key") or os.getenv("DASHSCOPE_API_KEY")
        
        if not api_key:
            raise ValueError(
                "未配置 DashScope API Key！\n"
                "请设置环境变量 DASHSCOPE_API_KEY 或在 config/agent.yaml 中配置 embedding_model_api_key"
            )
        
        return DashScopeEmbeddings(
            model=agent_conf["embedding_model_name"],
            dashscope_api_key=api_key
        )


chat_model=MainChatModelFactory().generator()
backup_chat_model=BackupChatModelFactory().generator()
embedding_model=EmbeddingModelFactory().generator()