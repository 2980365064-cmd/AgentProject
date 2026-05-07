from utils.config_handler import prompts_conf
from utils.logger_handler import logger
from utils.path_tool import get_abs_path

def load_health_prompt():
    try:
        system_prompt_path = get_abs_path(prompts_conf["health_prompt_path"])
    except KeyError as e:
        logger.error("请检查prompts.yaml文件，是否缺少health_prompt_path字段")
        raise e

    try:
        return open(system_prompt_path, "r", encoding="utf-8").read()
    except FileNotFoundError as e:
        logger.error(f"解析系统提示词出错,{str(e)}")
        raise e
def load_management_prompt():
    try:
        system_prompt_path = get_abs_path(prompts_conf["management_prompt_path"])
    except KeyError as e:
        logger.error("请检查prompts.yaml文件，是否缺少management_prompt_path字段")
        raise e

    try:
        return open(system_prompt_path, "r", encoding="utf-8").read()
    except FileNotFoundError as e:
        logger.error(f"解析系统提示词出错,{str(e)}")
        raise e


def load_rag_prompt():
    try:
        system_prompt_path = get_abs_path(prompts_conf["rag_summary_prompt_path"])
    except KeyError as e:
        logger.error("请检查prompts.yaml文件，是否缺少rag_summary_prompt_path字段")
        raise e

    try:
        return open(system_prompt_path, "r", encoding="utf-8").read()
    except FileNotFoundError as e:
        logger.error(f"解析系统提示词出错,{str(e)}")
        raise e

def load_report_prompt():
    try:
        system_prompt_path = get_abs_path(prompts_conf["report_prompt_path"])
    except KeyError as e:
        logger.error("请检查prompts.yaml文件，是否缺少report_prompt_path字段")
        raise e

    try:
        return open(system_prompt_path, "r", encoding="utf-8").read()
    except FileNotFoundError as e:
        logger.error(f"解析系统提示词出错,{str(e)}")
        raise e
