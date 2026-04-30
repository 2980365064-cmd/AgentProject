import os

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from model.factory import embedding_model
from utils.config_handler import chroma_conf
from utils.file_handler import get_file_md5_hex, listdir_with_allowed_types, pdf_loader, text_loader
from utils.logger_handler import logger
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
            separators=chroma_conf["separators"],
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

        def save_md5_hex(md5_for_save:str):
            with open(get_abs_path(chroma_conf["md5_hex_store"]),"a",encoding="utf-8") as f:
                f.write(md5_for_save+"\n")

        def get_file_documents(read_path:str):
            if read_path.endswith("txt"):
                return text_loader(read_path)

            if read_path.endswith("pdf"):
                return pdf_loader(read_path)

            return  []



        allowed_file_path: list[str]=listdir_with_allowed_types(get_abs_path(chroma_conf["data_path"]),
                                                      tuple(chroma_conf["allow_knowledge_file_type"]))
        for path in allowed_file_path:
            md5_hex=get_file_md5_hex(path)
            if not md5_hex:
                continue
            if check_md5_hex(md5_hex):
                logger.info(f"文件{path}已处理过")
                continue

            try:
                documents:list[ Document] = get_file_documents(path)

                if not documents:
                    logger.warning(f"文件{path}为空,跳过")
                    continue
                split_document:list[ Document] = self.spliter.split_documents(documents)

                if not split_document:
                    logger.warning(f"文件{path}分块为空,跳过")
                    continue
                #存入向量库
                self.vector_store.add_documents(split_document)
                #保存文件MD5
                save_md5_hex(md5_hex)
                logger.info(f"文件{path}处理完毕")

            except Exception as e:
                logger.error(f"处理文件{path}失败,{str(e)}")

