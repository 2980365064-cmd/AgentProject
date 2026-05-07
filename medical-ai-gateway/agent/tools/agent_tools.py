import contextvars
import os
import random
from typing import Optional

import requests
from langchain_core.tools import tool
from rag.rag_service import RagSummarizationService
from utils.config_handler import agent_conf
from utils.logger_handler import logger
from utils.path_tool import get_abs_path
from model.factory import chat_model

external_data = {}
rag = RagSummarizationService()
JAVA_BACKEND_URL = os.environ.get("JAVA_BACKEND_URL", "http://localhost:8081")

# 由 ReactAgent.execute_stream 在收到 Java 网关 bearer_token 时设置，供本模块 HTTP 回调使用
current_bearer_token: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_bearer_token", default=None
)


@tool(description="通过医生姓名，获取医生信息")
def get_doctor_info(name: str) -> str:
    """


    Args:
        name: 医生姓名

    Returns:
        医生信息的字符串描述，未找到则返回空字符串
    """
    try:
        url = f"{JAVA_BACKEND_URL}/api/v1/ai-assistant/searchDoctor"
        params = {"name": name}





        response = requests.get(url, params=params, timeout=5)

        if response.status_code == 200:
            data = response.json()

            logger.debug(f"🔍 原始响应数据: {data}")

            if isinstance(data, dict):
                # ✅ 兼容两种返回格式：code 或 status
                code = data.get("code")
                status = data.get("status")
                message = data.get("message", "")

                # 判断是否成功：code==200 或 status=="success"
                is_success = (code == 200) or (status == "success")

                if is_success:
                    doctors_data = data.get("data", [])

                    if isinstance(doctors_data, list) and len(doctors_data) > 0:
                        doctor_list = []
                        for doc in doctors_data:
                            if isinstance(doc, dict):
                                info = (
                                    f"姓名: {doc.get('name', '未知')}, "
                                    f"专科: {doc.get('specialisation', '未知')}, "
                                    f"病区: {doc.get('ward', '未知') or '无'}, "
                                    f"医疗组: {doc.get('team', '未知')}"
                                )
                                doctor_list.append(info)

                        if doctor_list:
                            result = "\n".join(doctor_list)
                            logger.info(f"✅ 查询到 {len(doctor_list)} 位名为 '{name}' 的医生")
                            return result

                    logger.warning(f"⚠️ 未找到名为 '{name}' 的医生")
                    return ""
                else:
                    logger.error(f"❌ 后端返回错误: status={status}, code={code}, message={message}")
                    return f"查询失败: {message}"
            else:
                logger.error(f"❌ 响应格式错误，期望dict，实际: {type(data)}")
                return ""
        elif response.status_code == 403:
            logger.error("❌ 403 Forbidden - JWT Token无效")
            return "权限验证失败"
        else:
            logger.error(f"❌ HTTP请求失败，状态码：{response.status_code}")
            return ""

    except requests.exceptions.Timeout:
        logger.error("❌ 请求超时")
        return "查询超时，请稍后重试"
    except requests.exceptions.ConnectionError:
        logger.error("❌ 无法连接到Java后端")
        return "后端服务未启动"
    except Exception as e:
        logger.error(f"❌ 查询异常：{e}", exc_info=True)
        return f"查询失败: {str(e)}"


@tool(description="通过患者姓名，获取患者信息")
def get_patient_info(name: str) -> str:
    """

    Args:
        name: 患者姓名

    Returns:
        患者信息的字符串描述，未找到则返回空字符串
    """
    try:
        url = f"{JAVA_BACKEND_URL}/api/v1/ai-assistant/searchPatient"
        params = {"name": name}





        response = requests.get(url, params=params,  timeout=5)

        if response.status_code == 200:
            data = response.json()

            logger.debug(f"🔍 原始响应数据: {data}")

            if isinstance(data, dict):
                code = data.get("code")
                status = data.get("status")
                message = data.get("message", "")

                is_success = (code == 200) or (status == "success")

                if is_success:
                    patients_data = data.get("data", [])

                    if isinstance(patients_data, list) and len(patients_data) > 0:
                        patient_list = []
                        for pat in patients_data:
                            if isinstance(pat, dict):
                                info = (
                                    f"姓名: {pat.get('name', '未知')}, "
                                    f"年龄: {pat.get('age', '未知')}, "
                                    f"性别: {pat.get('gender', '未知')}, "
                                    f"证件号: {pat.get('nic', '未知')}, "
                                    f"病区: {pat.get('ward', '未知') or '无'}, "
                                    f"医疗组: {pat.get('team', '未知')}"
                                )
                                patient_list.append(info)

                        if patient_list:
                            result = "\n".join(patient_list)
                            logger.info(f"✅ 查询到 {len(patient_list)} 位名为 '{name}' 的患者")
                            return result

                    logger.warning(f"⚠️ 未找到名为 '{name}' 的患者")
                    return ""
                else:
                    logger.error(f"❌ 后端返回错误: status={status}, code={code}, message={message}")
                    return f"查询失败: {message}"
            else:
                logger.error(f"❌ 响应格式错误，期望dict，实际: {type(data)}")
                return ""
        elif response.status_code == 403:
            logger.error("❌ 403 Forbidden - JWT Token无效")
            return "权限验证失败"
        else:
            logger.error(f"❌ HTTP请求失败，状态码：{response.status_code}")
            return ""

    except requests.exceptions.Timeout:
        logger.error("❌ 请求超时")
        return "查询超时，请稍后重试"
    except requests.exceptions.ConnectionError:
        logger.error("❌ 无法连接到Java后端")
        return "后端服务未启动"
    except Exception as e:
        logger.error(f"❌ 查询异常：{e}", exc_info=True)
        return f"查询失败: {str(e)}"


@tool(description="获取所有医生的信息，无需任何参数，直接返回所有医生的基本信息")
def get_all_doctor_info() -> str:
    """
    获取全院所有医生的基本信息

    Returns:
        所有医生信息的字符串描述，未找到则返回空字符串
    """
    try:
        url = f"{JAVA_BACKEND_URL}/api/v1/ai-assistant/allDoctors"



        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            data = response.json()

            logger.debug(f"🔍 allDoctors原始响应: {data}")

            if isinstance(data, dict):
                code = data.get("code")
                status = data.get("status")
                message = data.get("message", "")

                is_success = (code == 200) or (status == "success")

                if is_success:
                    doctors_data = data.get("data", [])

                    if isinstance(doctors_data, list) and len(doctors_data) > 0:
                        doctor_list = []
                        for doc in doctors_data:
                            if isinstance(doc, dict):
                                info = (
                                    f"姓名: {doc.get('name', '未知')}, "
                                    f"专科: {doc.get('specialisation', '未知')}, "
                                    f"病区: {doc.get('ward', '未知') or '无'}, "
                                    f"医疗组: {doc.get('team', '未知')}, "
                                    f"手机: {doc.get('mobile', '未知')}"
                                )
                                doctor_list.append(info)

                        result = "\n".join(doctor_list)
                        logger.info(f"✅ 查询到 {len(doctor_list)} 位医生")
                        return result
                    else:
                        logger.warning("⚠️ 后端返回的医生列表为空")
                        return "当前系统中没有医生记录"
                else:
                    logger.error(f"❌ 后端返回错误: status={status}, code={code}, message={message}")
                    return f"查询失败: {message}"
            else:
                logger.error(f"❌ 响应格式错误，期望dict，实际: {type(data)}")
                return "数据格式异常"
        elif response.status_code == 403:
            logger.error("❌ 403 Forbidden - JWT Token无效")
            return "权限验证失败"
        else:
            logger.error(f"❌ HTTP请求失败，状态码：{response.status_code}")
            return f"查询失败，HTTP状态码: {response.status_code}"

    except requests.exceptions.Timeout:
        logger.error("❌ 请求超时")
        return "查询超时，请稍后重试"
    except requests.exceptions.ConnectionError:
        logger.error("❌ 无法连接到Java后端")
        return "后端服务未启动，请先启动医院管理系统"
    except Exception as e:
        logger.error(f"❌ 获取医生信息异常：{e}", exc_info=True)
        return f"查询失败: {str(e)}"

@tool(description="根据患者输入的症状描述，提取关键症状信息并生成结构化总结，用于后续推荐合适的医生科室。当患者描述自己的不适、病情、症状时使用此工具。")
def summarize_symptoms(patient_info: str) -> str:
    """
    根据患者输入的症状信息，生成结构化总结

    提取内容包括：
    - 主要症状
    - 症状持续时间
    - 严重程度
    - 伴随症状
    - 可能的科室方向

    Args:
        patient_info (str): 患者输入的症状描述

    Returns:
        str: 结构化的症状总结，包含推荐的就诊科室
    """
    try:
        if not patient_info or len(patient_info.strip()) < 5:
            return "患者描述过于简短，无法提取有效症状信息"

        # 构建症状提取的Prompt
        symptom_prompt = f"""
你是一个专业的医疗分诊助手。请从以下患者描述中提取关键症状信息，并生成结构化总结。

患者描述：
{patient_info}

请按照以下格式输出（严格遵循）：

推荐科室名称|医生列表JSON字符串

注意：
1. 只提取患者明确提到的症状，不要推测
2. 如果某些信息未提及，标注"未提及"
3. 科室推荐要具体，避免模糊
4. 保持简洁，每项不超过20字
"""

        # 调用LLM生成总结
        messages = [
            ("system", "你是专业的医疗分诊助手，擅长从患者描述中提取症状信息，并推荐合适的医生科室。"),
            ("human", symptom_prompt)
        ]

        response = chat_model.invoke(messages)
        summary = response.content.strip()

        if isinstance(summary, str) and summary:
            logger.info(f"✅ 症状总结生成成功，长度: {len(summary)} 字符")
            return summary
        else:
            logger.warning("⚠️ LLM返回内容为空")
            return "未能生成症状总结，请稍后重试"

    except Exception as e:
        logger.error(f"❌ 症状总结生成失败: {e}", exc_info=True)
        return f"症状分析失败: {str(e)}"


@tool(
    description=(
        "一站式服务：症状→推荐医生→预约挂号。"
        "管理员代预约时请尽量传入 patient_nic（患者证件号）；患者本人登录渠道可省略。"
    )
)
def smart_recommend_and_book(
    symptom_description: str,
    patient_name: str,
    preferred_date: Optional[str] = None,
    preferred_time: Optional[str] = None,
    patient_nic: Optional[str] = None,
) -> str:
    """
    智能推荐医生并预约挂号的组合工具

    严格按以下流程执行：
    第1步：调用summarize_symptoms分析症状，提取建议科室
    第2步：调用get_all_doctor_info获取所有医生
    第3步：调用filter_doctors_by_department按科室筛选医生
    第4步：从推荐医生中选择第一位
    第5步：调用book_appointment完成预约挂号

    Args:
        symptom_description: 患者的症状描述（如："我骨折了"、"头痛三天"）
        patient_name: 患者姓名（用于预约）
        preferred_date: 可选，期望的就诊日期（格式：YYYY-MM-DD），不指定则使用明天
        preferred_time: 可选，期望的就诊时间（格式：HH:MM），不指定则使用09:00

    Returns:
        包含症状分析、医生推荐、预约结果的完整报告
    """
    try:
        logger.info(f"🏥 ========== 开始智能推荐+预约流程 ==========")
        logger.info(f"   患者: {patient_name}")
        logger.info(f"   症状: {symptom_description[:50]}...")
        logger.info(f"   期望日期: {preferred_date or '明天'}")
        logger.info(f"   期望时间: {preferred_time or '09:00'}")

        import re
        import json
        from datetime import datetime, timedelta

        # ===== 第1步：分析症状，提取科室 =====
        logger.info("📋 第1步/5：分析症状，提取建议科室...")
        symptom_summary = summarize_symptoms.invoke({"patient_info": symptom_description})

        if not symptom_summary or "失败" in symptom_summary:
            return f"""❌ 症状分析失败

无法分析您的症状，建议：
1. 详细描述您的不适症状
2. 说明症状持续时间
3. 提及伴随的其他症状

示例："我三天前摔伤了左腿，现在走路疼痛，可能骨折了"
"""

        logger.info(f"✅ 第1步完成 - 症状分析结果:\n{symptom_summary}")

        # ===== 第2步：从症状总结中提取科室名称 =====
        logger.info("📋 第2步/5：从症状总结中提取建议科室...")

        # 尝试多种格式提取科室
        recommended_dept = None

        # 格式1: "推荐科室名称|..." （LLM输出的特殊格式）
        if "|" in symptom_summary:
            parts = symptom_summary.split("|", 1)
            potential_dept = parts[0].strip()
            # 检查是否包含科室关键词
            dept_keywords = ["科", "内科", "外科", "骨科", "儿科", "妇科", "眼科"]
            if any(keyword in potential_dept for keyword in dept_keywords):
                recommended_dept = potential_dept
                logger.info(f"   从分隔符格式提取到科室: {recommended_dept}")

        # 格式2: 【建议科室】xxx
        if not recommended_dept:
            dept_match = re.search(r'【建议科室】\s*([^\n]+)', symptom_summary)
            if dept_match:
                recommended_dept = dept_match.group(1).strip()
                logger.info(f"   从标签格式提取到科室: {recommended_dept}")

        # 格式3: 直接包含科室名称
        if not recommended_dept:
            dept_keywords = ["神经内科", "骨科", "心血管内科","普通外科",
                           "儿科", ]
            for dept in dept_keywords:
                if dept in symptom_summary:
                    recommended_dept = dept
                    logger.info(f"   从关键词匹配到科室: {recommended_dept}")
                    break

        if not recommended_dept:
            recommended_dept = "全科医学科"  # 默认科室
            logger.warning(f"   ⚠️ 未能提取科室，使用默认: {recommended_dept}")

        logger.info(f"✅ 第2步完成 - 建议科室: {recommended_dept}")

        # ===== 第3步：获取所有医生 =====
        logger.info("📋 第3步/5：获取所有医生信息...")
        all_doctors_result = get_all_doctor_info.invoke({})

        if not all_doctors_result or "失败" in all_doctors_result or "异常" in all_doctors_result:
            return f"""❌ 获取医生列表失败

症状分析结果：
{symptom_summary}

错误信息：{all_doctors_result}

建议您稍后重试或联系医院前台。
"""

        logger.info(f"✅ 第3步完成 - 获取医生列表成功")

        # ===== 第4步：根据科室筛选医生 =====
        logger.info(f"📋 第4步/5：根据科室 [{recommended_dept}] 筛选医生...")

        # 构造filter_doctors_by_department的输入
        filter_input = f"{recommended_dept}|{all_doctors_result}"
        recommendation_result = filter_doctors_by_department.invoke({"input_data": filter_input})

        if "未找到" in recommendation_result or "暂无" in recommendation_result:
            return f"""⚠️ 未找到合适科室的医生

症状分析：
{symptom_summary}

建议科室：{recommended_dept}

医生匹配结果：
{recommendation_result}

请您：
1. 尝试其他相关科室
2. 咨询医院分诊台
3. 前往全科医学科就诊
"""

        logger.info(f"✅ 第4步完成 - 医生推荐结果:\n{recommendation_result}")

        # ===== 第5步：提取第一位医生并预约 =====
        logger.info("📋 第5步/5：为推荐医生预约挂号...")

        # 从推荐结果中提取第一位医生姓名
        first_doctor_match = re.search(r'姓名:\s*([^,\n]+)', recommendation_result)
        if not first_doctor_match:
            return f"""❌ 无法从推荐结果中提取医生信息

推荐结果：
{recommendation_result}

请手动选择医生进行预约。
"""

        recommended_doctor = first_doctor_match.group(1).strip()
        logger.info(f"   推荐医生: {recommended_doctor}")

        # 处理默认日期和时间
        if not preferred_date:
            # 默认为明天
            tomorrow = datetime.now() + timedelta(days=1)
            preferred_date = tomorrow.strftime("%Y-%m-%d")

        if not preferred_time:
            preferred_time = "09:00"

        logger.info(f"   预约时间: {preferred_date} {preferred_time}")

        # 调用预约工具
        appointment_result = book_appointment.invoke({
            "patient_name": patient_name,
            "doctor_name": recommended_doctor,
            "date": preferred_date,
            "time": preferred_time,
            "patient_nic": (patient_nic or "").strip(),
        })

        logger.info(f"✅ 第5步完成 - 预约结果:\n{appointment_result}")

        # ===== 生成完整报告 =====
        logger.info(f"🏥 ========== 智能推荐+预约流程完成 ==========")

        final_report = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 智能医疗助手 - 完整服务报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 一、症状分析
{symptom_summary}

👨‍⚕️ 二、医生推荐
{recommendation_result}

📅 三、预约结果
{appointment_result}

💡 温馨提示
1. 请按时前往医院就诊
2. 携带身份证和医保卡
3. 如需改期，请提前联系医院
4. 如果症状加重，请立即前往急诊

⚠️ 免责声明
以上建议仅为初步健康咨询，不能替代专业医生的诊断。
如果症状持续、加重或出现新的不适，请及时前往正规医院就诊。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

        return final_report

    except Exception as e:
        logger.error(f"❌ 智能推荐+预约流程失败: {e}", exc_info=True)
        return f"""❌ 服务失败

错误信息：{str(e)}

建议您：
1. 检查网络连接
2. 稍后重试
3. 如情况紧急，请直接前往医院急诊科
"""

@tool(description="根据科室名称，从医生列表中筛选匹配的医生。输入格式：'科室名称|医生列表JSON'")
def filter_doctors_by_department(input_data: str) -> str:
    """
    根据科室名称筛选医生

    Args:
        input_data: 格式为 "科室名称|医生列表JSON字符串"
                   例如："神经内科|[{'name':'张医生','specialisation':'Neurology'},...]"

    Returns:
        匹配医生的列表字符串
    """
    try:
        if "|" not in input_data:
            return "输入格式错误，应为：科室名称|医生列表JSON"

        parts = input_data.split("|", 1)
        department = parts[0].strip()
        doctors_json = parts[1].strip()

        import json

        # 解析医生列表
        try:
            doctors = json.loads(doctors_json)
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON解析失败: {e}")
            return f"医生数据格式错误: {str(e)}"

        if not isinstance(doctors, list):
            return "医生数据应为列表格式"

        # 科室映射表（中英文对照）
        dept_mapping = {
            "内科": ["internal medicine", "内科"],
            "普通外科": ["surgery", "外科"],
            "神经内科": ["neurology", "神经内科"],
            "心血管内科": ["cardiology", "心血管", "心脏"],
            "骨科": ["orthopedics", "骨科"],
            "儿科": ["pediatrics", "儿科"],
        }

        # 查找匹配的医生
        matched_doctors = []
        for doc in doctors:
            if not isinstance(doc, dict):
                continue

            specialisation = doc.get("specialisation", "").lower()
            ward = doc.get("ward", "").lower()
            team = doc.get("team", "").lower()
            name = doc.get("name", "")

            # 检查是否匹配目标科室
            is_match = False

            # 直接匹配
            if department.lower() in specialisation or \
                    department.lower() in ward or \
                    department.lower() in team:
                is_match = True

            # 通过映射表匹配
            if not is_match and department in dept_mapping:
                for keyword in dept_mapping[department]:
                    if keyword.lower() in specialisation or \
                            keyword.lower() in ward or \
                            keyword.lower() in team:
                        is_match = True
                        break

            if is_match:
                matched_doctors.append(doc)

        if matched_doctors:
            doctor_list = []
            for doc in matched_doctors:
                info = (
                    f"姓名: {doc.get('name', '未知')}, "
                    f"专科: {doc.get('specialisation', '未知')}, "
                    f"病区: {doc.get('ward', '未知') or '无'}, "
                    f"医疗组: {doc.get('team', '未知')}"
                )
                doctor_list.append(info)

            result = f"✅ 为您推荐 {len(matched_doctors)} 位{department}医生：\n\n" + "\n".join(doctor_list)
            logger.info(f"✅ 匹配到 {len(matched_doctors)} 位{department}医生")
            return result
        else:
            return f"⚠️ 未找到{department}的医生，建议您：\n1. 尝试其他相关科室\n2. 咨询分诊台\n3. 前往急诊科（如情况紧急）"

    except Exception as e:
        logger.error(f"❌ 医生匹配失败: {e}", exc_info=True)
        return f"医生推荐失败: {str(e)}"


@tool(
    description=(
        "为患者预约挂号。需要：患者姓名、医生姓名、日期 YYYY-MM-DD、时间 HH:MM。"
        "管理员代预约时必须同时传患者证件号 patient_nic（与医院档案 NIC 一致）；"
        "患者本人通过 App 登录对话时可省略 patient_nic。"
    )
)
def book_appointment(
    patient_name: str,
    doctor_name: str,
    date: str,
    time: str,
    patient_nic: str = "",
) -> str:
    """
    为患者预约挂号
    
    Args:
        patient_name: 患者姓名
        doctor_name: 医生姓名
        date: 预约日期，格式 YYYY-MM-DD
        time: 预约时间，格式 HH:MM
        patient_nic: 患者 NIC；管理助手代预约时必填，健康助手可省略（用登录用户 NIC）
        
    Returns:
        预约结果的字符串描述
    """
    try:
        logger.info(
            f"📅 开始预约挂号: 患者={patient_name}, 医生={doctor_name}, 日期={date}, 时间={time}, nic={patient_nic or '(登录用户)'}"
        )
        
        # ✅ 修正为Java后端正确的接口路径
        url = f"{JAVA_BACKEND_URL}/api/v1/ai-assistant/appointment"
        
        payload = {
            "patientName": patient_name,
            "doctorName": doctor_name,
            "appointmentDate": date,
            "appointmentTime": time,
        }
        nic_val = (patient_nic or "").strip()
        if nic_val:
            payload["patientNic"] = nic_val

        headers = {"Content-Type": "application/json"}
        tok = current_bearer_token.get()
        if tok:
            headers["Authorization"] = f"Bearer {tok}"
        else:
            logger.warning("⚠️ book_appointment 未携带 JWT（current_bearer_token 为空），Java 可能返回 401/403")

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        # ✅ 先检查响应状态码，再决定如何处理
        if response.status_code == 200:
            # 检查响应体是否为空
            if not response.text or not response.text.strip():
                logger.warning("⚠️ 后端返回空响应体")
                return (
                    f"⚠️ 预约系统返回空响应\n\n"
                    f"患者: {patient_name}\n"
                    f"医生: {doctor_name}\n"
                    f"时间: {date} {time}\n\n"
                    f"建议联系医院前台确认预约是否成功。"
                )
            
            try:
                data = response.json()
            except Exception as json_err:
                logger.error(f"❌ JSON解析失败: {json_err}, 响应内容: {response.text[:200]}")
                return f"❌ 预约响应格式错误，请稍后重试"
            
            if isinstance(data, dict):
                status = data.get("status")
                message = data.get("message", "")
                appointment_data = data.get("data", {})
                
                # ✅ 兼容两种返回格式
                is_success = (data.get("code") == 200) or (status == "success")
                
                if is_success:
                    appointment_id = appointment_data.get("appointmentId", "未知")
                    scheduled_time = appointment_data.get("scheduledTime", f"{date} {time}")
                    
                    result = (
                        f"✅ 预约成功！\n\n"
                        f"预约编号: {appointment_id}\n"
                        f"患者姓名: {patient_name}\n"
                        f"就诊医生: {doctor_name}\n"
                        f"预约时间: {scheduled_time}\n"
                        f"备注: {message if message else '请按时就诊'}"
                    )
                    
                    logger.info(f"✅ 预约成功: {appointment_id}")
                    return result
                else:
                    return f"❌ 预约失败: {message}"
            else:
                return "预约响应格式异常"
                
        elif response.status_code == 401:
            logger.error("❌ 401 Unauthorized - 未携带有效 JWT")
            return (
                "⚠️ 预约接口需要登录凭证。\n\n"
                "请通过医院系统已登录渠道（如 App 内健康助手、WebSocket 对话）发起对话，"
                "勿在离线脚本中单独运行 Agent（此时无法把 JWT 传给 Java）。"
            )
        elif response.status_code == 403:
            logger.error("❌ 403 Forbidden - 需要JWT认证或权限不足")
            return (
                f"⚠️ 预约需要身份认证\n\n"
                f"患者: {patient_name}\n"
                f"医生: {doctor_name}\n"
                f"时间: {date} {time}\n\n"
                f"请联系管理员配置预约权限，或使用已登录的账号进行预约。"
            )
        elif response.status_code == 404:
            # 接口不存在
            return (
                f"⚠️ 预约挂号功能暂未开通\n\n"
                f"患者: {patient_name}\n"
                f"医生: {doctor_name}\n"
                f"预约时间: {date} {time}\n\n"
                f"建议您：\n"
                f"1. 联系医院前台进行人工预约\n"
                f"2. 使用医院官方APP或微信公众号预约\n"
                f"3. 前往医院现场挂号"
            )
        elif response.status_code == 500:
            return f"❌ 预约系统内部错误，请联系医院管理员"
        else:
            return f"预约失败，HTTP状态码: {response.status_code}"
            
    except requests.exceptions.Timeout:
        logger.error("❌ 预约请求超时")
        return "预约请求超时，请稍后重试"
    except requests.exceptions.ConnectionError:
        logger.error("❌ 无法连接到预约系统")
        return "预约系统暂时不可用，请联系医院前台"
    except Exception as e:
        logger.error(f"❌ 预约挂号异常: {e}", exc_info=True)
        return f"预约失败: {str(e)}"


@tool(description="从检索服务中检索参考资料")
def rag_summarize(query: str) -> str:
    return rag.rag_summarize(query)


@tool(description="推荐医院")
def recommend_hospital(location: str, department: str) -> str:
    """
        当需要为患者推荐附近医院时调用此工具。
        参数:
        - location: 患者所在的地理位置（如：北京市朝阳区、山东省泰安市等）。
        - department: 根据患者症状推断出的就诊科室（如：消化内科、发热门诊等）。
        """
    return f"推荐医院：{location}的{department}科室"


@tool(description="天气服务")
def get_weather(location: str) -> str:
    return "晴，33度"


@tool(description="获取用户所在城市名称")
def get_user_location() -> str:
    return random.choice(["北京", "上海", "广州", "深圳"])


@tool(description="获取用户ID")
def get_user_id() -> str:
    return "1004"


@tool(description="获取当前月份")
def get_current_month() -> str:
    return "2025-08"

def generate_external_data(user_id: str, month: str):
    """
    生成外部数据

    数据格式：
    {
      "user_id":{
         "month":{"特征":xxx,"效率":xxx}
      }
    }

    :param user_id: 用户ID
    :param month: 月份
    :return: None
    """
    if not external_data:
        path = get_abs_path(agent_conf["external_data_path"])
        if not os.path.exists(path):
            raise FileNotFoundError(f"文件{path}不存在")
        with open(path, "r", encoding="utf-8") as f:
            for line in f.readlines()[1:]:
                arr: list[str] = line.strip().split(",")
                user_id: str = arr[0].replace('"', "")
                feature: str = arr[1].replace('"', "")
                efficiency: str = arr[2].replace('"', "")
                consumables: str = arr[3].replace('"', "")
                comparison: str = arr[4].replace('"', "")
                time: str = arr[5].replace('"', "")

                if user_id not in external_data:
                    external_data[user_id] = {}
                external_data[user_id][month] = {
                    "特征": feature,
                    "效率": efficiency,
                    "耗材": consumables,
                    "对比": comparison,
                }


@tool(description="从外部系统获取指定用户在指定月份使用记录，若未检索到，则返回空字符串")
def fetch_external_data(user_id: str, month: str) -> str:
    generate_external_data(user_id, month)
    try:
        return external_data[user_id][month]
    except KeyError:
        logger.warning(f"未找到用户{user_id}在{month}的记录")
        return ""


@tool(description="无入参，无返回值，调用后触发中间件，填充报告所需要的上下文信息")
def fill_context_for_report():
    return "fill_context_for_report已调用"
