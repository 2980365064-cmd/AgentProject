import os
import random
from datetime import datetime

from langchain_core.tools import tool
from rag.rag_service import RagSummarizationService
from utils.config_handler import agent_conf
from utils.logger_handler import logger
from utils.path_tool import get_abs_path

external_data={}
rag=RagSummarizationService()
@tool(description="从检索服务中检索参考资料")
def rag_summarize(query:str) ->str:
    return rag.rag_summarize( query)

@tool(description="天气服务")
def get_weather(location:str) ->str:
    return "晴，33度"

@tool(description="获取用户所在城市名称")
def get_user_location() -> str:
    return random.choice(["北京","上海","广州","深圳"])

@tool(description="获取用户ID")
def get_user_id() -> str:
    return "1004"

@tool(description="获取当前月份")
def get_current_month() -> str:
    return "2025-08"

#生成外部数据
def generate_external_data(user_id:str,month:str) -> str:
    """
    {
      "user_id":{
         "month":{"特征":xxx,"效率":xxx}
      }
    }
    :param user_id:
    :param month:
    :return:
    """
    if not external_data:
        path = get_abs_path(agent_conf["external_data_path"])
        if not os.path.exists(path):
            raise FileNotFoundError(f"文件{path}不存在")
        with open(path, "r", encoding="utf-8") as f:
            for line in f.readlines()[1:]:
                arr: list[str] = line.strip().split(",")
                user_id:str = arr[0].replace('"', "")
                feature:str = arr[1].replace('"', "")
                efficiency:str = arr[2].replace('"', "")
                consumables:str = arr[3].replace('"', "")
                comparison:str = arr[4].replace('"', "")
                time:str=arr[5].replace('"', "")

                if user_id not in external_data:
                    external_data[user_id]={}
                external_data[user_id][month]={
                    "特征":feature,
                    "效率":efficiency,
                    "耗材":consumables,
                    "对比":comparison,
                }


@tool(description="从外部系统获取指定用户在指定月份使用记录，若未检索到，则返回空字符串")
def fetch_external_data(user_id:str, month:str) -> str:
    generate_external_data(user_id,month)
    try:
        return external_data[user_id][month]
    except KeyError:
        logger.warning(f"未找到用户{user_id}在{month}的记录")
        return ""

@tool(description="无入参，无返回值，调用后触发中间件，填充报告所需要的上下文信息")
def fill_context_for_report():
  return "fill_context_for_report已调用"
