"""
yaml
"""
import yaml
import re
import os
from utils.path_tool import get_abs_path

def load_rag_config(config_path:str=get_abs_path("config/rag.yaml"),encoding="utf-8"):
   with open(config_path,"r",encoding=encoding) as f:
       return yaml.load(f,Loader=yaml.FullLoader)

def load_chroma_config(config_path:str=get_abs_path("config/chroma.yaml"),encoding="utf-8"):
   with open(config_path,"r",encoding=encoding) as f:
       return yaml.load(f,Loader=yaml.FullLoader)

def load_prompts_config(config_path:str=get_abs_path("config/prompts.yaml"),encoding="utf-8"):
   with open(config_path,"r",encoding=encoding) as f:
       return yaml.load(f,Loader=yaml.FullLoader)

def load_redis_config(config_path: str = get_abs_path("config/redis.yaml"), encoding="utf-8"):
    with open(config_path, "r", encoding=encoding) as f:
        return yaml.load(f, Loader=yaml.FullLoader)


def load_agent_config(config_path:str=get_abs_path("config/agent.yaml"),encoding="utf-8"):
   with open(config_path,"r",encoding=encoding) as f:
       content = f.read()
   
   # 替换 ${ENV_VAR} 格式的环境变量
   def replace_env_var(match):
       var_name = match.group(1)
       env_value = os.environ.get(var_name)
       if env_value is None:
           raise EnvironmentError(f"环境变量 {var_name} 未设置，请在系统中配置该环境变量")
       return env_value
   
   content = re.sub(r'\$\{(\w+)\}', replace_env_var, content)
   
   return yaml.load(content, Loader=yaml.FullLoader)

rag_conf=load_rag_config()
chroma_conf=load_chroma_config()
prompts_conf=load_prompts_config()
agent_conf=load_agent_config()
redis_conf=load_redis_config()

