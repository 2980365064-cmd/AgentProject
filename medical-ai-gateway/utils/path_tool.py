"""
为整个工程提供统一的绝对路径
"""
import os
def get_project_root() ->str:
    """
    获取工程所在根目录
    :return:字符串根目录
    """
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
#传入相对路径，返回绝对路径
def get_abs_path(relative_path:str) ->str:
    """
    获取绝对路径
    :param relative_path: 相对路径
    :return: 绝对路径
    """
    return os.path.join(get_project_root(), relative_path)