
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
#聊天模型工厂
class ChatModelFactory(BaseModelFactory):
    def generator(self) ->Optional[Embeddings|BaseChatModel]:
        return ChatOpenAI(model=agent_conf["chat_model_name"])


#嵌入模型工厂
class EmbeddingModelFactory(BaseModelFactory):
    def generator(self) ->Optional[Embeddings|BaseChatModel]:
        return DashScopeEmbeddings(model=agent_conf["embedding_model_name"])


chat_model=ChatModelFactory().generator()
embedding_model=EmbeddingModelFactory().generator()