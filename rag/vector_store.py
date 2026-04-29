import os

from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from model.factory import embedding_model
from utils.config_handler import chroma_conf
from utils.path_tool import get_abs_path


#矢量数据库服务
class VectorStoreService:
    def __init__(self):
        self.vector_store = Chroma(
            collection_name=chroma_conf["collection_name"],
            embedding_function=embedding_model,
            persist_directory=chroma_conf["persist_directory"]
            )
        #文本分割器进行文本分块
        self.spliter=RecursiveCharacterTextSplitter(
            chunk_size=chroma_conf["chunk_size"],
            chunk_overlap=chroma_conf["chunk_overlap"],
            separator=chroma_conf["separator"],
            length_function=len,
        )
    #返回一个检索器
    def get_retriever(self):
        return self.vector_store.as_retriever(search_kwargs={"k":chroma_conf["k"]})

    def load_document(self):
        """
        从数据文件中读取数据，转为向量存入向量库
        计算文件的MD5并去重
        :return:
        """
        # 检查文件MD5
        def check_md5_hex(md5_for_check:str):
            if not os.path.exists(get_abs_path(chroma_conf["md5_hex_store"])):
                #创建文件
                open(get_abs_path(chroma_conf["md5_hex_store"]),"w",encoding="utf-8").close()
                return  False #md5未处理过

            with open(get_abs_path(chroma_conf["md5_hex_store"]),"r",encoding="utf-8") as f:
                for line in f.readlines():
                    line=line.strip()
                    if line==md5_for_check:
                        return True#文件已处理过

                return  False#文件未处理过
