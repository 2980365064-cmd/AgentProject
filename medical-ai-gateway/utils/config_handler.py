import os
import re
import yaml
from pathlib import Path

def load_rag_config():
    config_path = Path(__file__).parent.parent / "config" / "rag.yaml"
    return _load_yaml_with_env(config_path)

def load_chroma_config():
    config_path = Path(__file__).parent.parent / "config" / "chroma.yaml"
    return _load_yaml_with_env(config_path)

def load_elasticsearch_config():
    """加载 Elasticsearch 配置"""
    config_path = Path(__file__).parent.parent / "config" / "elasticsearch.yaml"
    return _load_yaml_with_env(config_path)

def load_prompts_config():
    config_path = Path(__file__).parent.parent / "config" / "prompts.yaml"
    return _load_yaml_with_env(config_path)

def load_agent_config():
    config_path = Path(__file__).parent.parent / "config" / "agent.yaml"
    return _load_yaml_with_env(config_path)

def load_redis_config():
    config_path = Path(__file__).parent.parent / "config" / "redis.yaml"
    return _load_yaml_with_env(config_path)

def _load_yaml_with_env(config_path: Path):
    """加载 YAML 配置文件并替换环境变量"""
    if not config_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_path}")
    
    with open(config_path, "r", encoding="utf-8") as f:
        content = f.read()
    
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
es_conf=load_elasticsearch_config()
prompts_conf=load_prompts_config()
agent_conf=load_agent_config()
redis_conf=load_redis_config()

