from typing import Callable

from langchain.agents import AgentState
from langgraph.runtime import Runtime
from langgraph.types import Command
from langchain.agents.middleware import ModelRequest, before_model, dynamic_prompt, wrap_tool_call
from langchain_core.messages import ToolMessage
from langgraph.prebuilt.tool_node import ToolCallRequest

from utils.logger_handler import logger
from utils.prompts_loader import load_report_prompt, load_system_prompt


#工具执行的监控
@wrap_tool_call
def monitor_tool(
        # 请求的数据封装
        request:ToolCallRequest,
        # 执行的函数本身
        handler: Callable[[ToolCallRequest], ToolMessage|Command],
) -> ToolMessage|Command:
    logger.info(f"[tool monitor]执行工具：{request.tool_call['name']}")
    logger.info(f"[tool monitor]传入参数：{request.tool_call['args']}")
    try:
        result = handler(request)
        logger.info(f"[tool monitor]工具调用成功")

        if request.tool_call["name"]=="fill_context_for_report":
            request.runtime.context["report"] = True

        return  result
    except Exception as e:
        logger.error(f"[tool monitor]工具调用失败,{str(e)}")
        raise e

@before_model
#模型执行前输出日志
def log_before_model(
        # 整个Agent智能体的状态记录
        state:AgentState,
        # 记录了整个执行过程的运行信息
        runtime:Runtime,
):
    logger.info(f"[model monitor]即将调用模型，带有{len(state['messages'])}条消息")

    return None

#动态切换提示词
@dynamic_prompt #每次在生成提示词之前都会执行此函数
def report_prompt_switch(request:ModelRequest):
    is_report=request.runtime.context.get("report",False)
    if is_report: #是报告,使用报告提示词
        return load_report_prompt()

    return load_system_prompt()