import os,hashlib

from langchain_core.documents import Document

from utils.logger_handler import logger
from langchain_community.document_loaders import PyPDFLoader,TextLoader

def get_file_md5_hex(file_path:str):
   """
   获取文件MD5值
   :return: MD5值
   """
   if not os.path.exists(file_path):
       print("文件不存在")

   if not os.path.isfile(file_path):
       print("不是文件")


   md5_obj = hashlib.md5()
   chunk_size = 4096
   try:
    with open(file_path, 'rb') as f:
       while chunk:=f.read(chunk_size):
           md5_obj.update(chunk)
           md5_hex = md5_obj.hexdigest()
           return md5_hex
   except Exception as e:
      logger.error(f"计算文件{file_path}MD5值失败,{str(e)}")
      return None

def listdir_with_allowed_types(file_path:str,allowed_types:tuple[str]): #返回文件列表（允许的文件后缀，过滤文件）
    files=[]
    if not os.path.isdir(file_path):
        logger.error(f"{file_path}不是文件夹")
        return files
    for f in os.listdir(file_path):
        if f.endswith(allowed_types):
            files.append(os.path.join(file_path,f))
    return tuple(files)


def pdf_loader(file_path:str,password:str=None) ->list[Document]:
    return PyPDFLoader(file_path,password).load()

def text_loader(file_path:str) ->list[Document]:
    try:
        return TextLoader(file_path, encoding='utf-8').load()
    except UnicodeDecodeError:
        try:
            return TextLoader(file_path, encoding='gbk').load()
        except Exception as e:
            logger.error(f"文本文件{file_path}编码解析失败,{str(e)}")
            return []
    except Exception as e:
        logger.error(f"文本文件{file_path}加载失败,{str(e)}")
        return []
