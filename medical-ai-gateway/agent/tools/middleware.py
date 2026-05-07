from typing import Callable

from langchain.agents import AgentState
from langgraph.runtime import Runtime
from langgraph.types import Command
from langchain.agents.middleware import before_model, wrap_tool_call
from langchain_core.messages import ToolMessage
from langgraph.prebuilt.tool_node import ToolCallRequest

from utils.logger_handler import logger


@wrap_tool_call
def monitor_tool(
        request:ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage|Command],
) -> ToolMessage|Command:
    logger.info(f"[tool monitor]执行工具：{request.tool_call['name']}")
    logger.info(f"[tool monitor]传入参数：{request.tool_call['args']}")
    try:
        result = handler(request)
        logger.info(f"[tool monitor]工具调用成功")

        return result
    except Exception as e:
        logger.error(f"[tool monitor]工具调用失败,{str(e)}")
        raise e

@before_model
def log_before_model(
        state:AgentState,
        runtime:Runtime,
):
    logger.info(f"[model monitor]即将调用模型，带有{len(state['messages'])}条消息")

    return None
