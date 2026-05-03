from fastapi import FastAPI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel

from agent.react_agent import ReactAgent
from model.factory import chat_model
app=FastAPI()
agent=ReactAgent()
class ChatRequest(BaseModel):
     user_input: str
     session_id: str

CRITICAL_KEYWORDS = [
    "胸痛", "胸闷", "喘不上气", "呼吸困难", "大量出血",
    "吐血", "昏迷", "失去意识", "剧痛", "自杀", "轻生"
]

# 关键词拦截器
def keyword_interceptor( user_input: str) -> bool:
    for word in CRITICAL_KEYWORDS:
        if word in user_input:
            return True  # 拦截
    return False


# 语义拦截器
def semantic_interceptor(user_input: str) -> bool:
    prompt = PromptTemplate.from_template("""
        你是急诊科护士，判断用户描述的症状是否属于危重症。
        如果是危重症，只回复 YES；如果不是，只回复 NO。不要回复其他内容。
        用户描述：{input}
        """)
    chain = prompt | chat_model | StrOutputParser()
    result = chain.invoke({"input": user_input})
    return result.strip().upper() == "YES"

@app.post("/chat")
async def chat(request: ChatRequest):
        user_input = request.user_input
        session_id = request.session_id


        if keyword_interceptor(user_input):
            return {
                "status": "emergency",
                "response": "【系统高优先级警告】检测到危急症状！请立即停止对话，拨打 120 急救电话或前往最近医院的急诊科就诊！"
            }
        if semantic_interceptor(user_input):
            return {
                "status": "emergency",
                "response": "【系统高优先级警告】检测到危急症状！请立即停止对话，拨打 120 急救电话或前往最近医院的急诊科就诊！"
            }

            # 正常对话流程 - 收集流式响应
        response_text = ""
        for chunk in agent.execute_stream(user_input, session_id):
            response_text += chunk

        return {
            "status": "success",
            "response": response_text
        }


