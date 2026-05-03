from typing import Iterator, Optional
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from agent.tools.agent_tools import  rag_summarize, recommend_hospital
from agent.tools.middleware import log_before_model, monitor_tool, report_prompt_switch
from model.factory import backup_chat_model, chat_model
from utils.prompts_loader import load_system_prompt
from utils.redis_chat_history import get_messages, save_messages


def _final_assistant_text(messages: list) -> str:
    """从完整消息列表中取最后一条有正文的助手回复（兼容工具调用后的终答）。"""
    last = ""
    for m in messages:
        if isinstance(m, AIMessage):
            c = m.content
            if isinstance(c, str) and c.strip():
                last = c.strip()
            elif isinstance(c, list):
                texts = []
                for block in c:
                    if isinstance(block, dict) and block.get("type") == "text":
                        texts.append(block.get("text", ""))
                joined = "".join(texts).strip()
                if joined:
                    last = joined
    return last

class ReactAgent:
    """
    ReactAgent 是一个基于 LangChain 的代理，用于处理用户输入并生成回复。
    """
    #创建一个带有降级机制、工具支持和中间件的 LangChain 代理
    model = chat_model.with_fallbacks([backup_chat_model])
    def __init__(self):
        self.agent=create_agent(
            model=self.model,
            system_prompt=load_system_prompt(),
            tools=[rag_summarize,recommend_hospital],
            middleware=[monitor_tool, log_before_model, report_prompt_switch],
        )


    def execute_stream(self, query: str, session_id: Optional[str] = None) -> Iterator[str]:
        prior: list[dict[str, str]] = get_messages(session_id) if session_id else []
        messages_input = [*prior, {"role": "user", "content": query}]
        input_dict = {"messages": messages_input}
        final_messages: list = []
        for chunk in self.agent.stream(input_dict, stream_mode="values", context={"report": False}):
            final_messages = chunk["messages"]
            latest_message = final_messages[-1]
            if isinstance(latest_message, AIMessage):
                content = latest_message.content or ""
                if isinstance(content, str) and content.strip():
                    yield content.strip() + "\n"
        if session_id:
            assistant_text = _final_assistant_text(final_messages)
            save_messages(
                session_id,
                [*prior, {"role": "user", "content": query}, {"role": "assistant", "content": assistant_text}],
            )

if __name__ == '__main__':
    agent=ReactAgent()
    stream = agent.execute_stream("我叫什么名字",1)
    for chunk in stream:
        print(chunk, end="")



