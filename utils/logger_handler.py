from  datetime import datetime
import logging
import os

from utils.path_tool import get_abs_path

#日志保存的根目录
LOG_ROOT = get_abs_path("logs")

#确保日志目录存在
os.makedirs(LOG_ROOT, exist_ok=True)

#日志的格式配置
DEFAULT_LOG_FORMAT = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s")

def get_logger(name: str="agent",
               console_level: int=logging.INFO,
               file_level:int=logging.DEBUG,
               log_file =None) -> logging.Logger:
    """
    获取日志对象
    :param name: 日志对象名称
    :return: 日志对象
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    # 如果已经添加了handler，则返回
    if logger.handlers:
        return logger
    #日志输出到控制台
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(DEFAULT_LOG_FORMAT)
    logger.addHandler(ch)
    #日志输出到文件
    if not log_file:
        log_file = os.path.join(LOG_ROOT, f"{name}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log")

    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setLevel(file_level)
    fh.setFormatter(DEFAULT_LOG_FORMAT)
    logger.addHandler(fh)
    return logger


logger = get_logger()
if __name__ == '__main__':
    logger.info("信息日")
    logger.error("错误日")
    logger.debug("调试日")
    logger.warning("警告日")