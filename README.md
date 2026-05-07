# AgentProject - 智能医疗AI系统

## 🏥 项目简介

AgentProject 是一套**前后端分离 + AI智能服务**的综合医疗管理系统，集成了医院管理、患者服务和AI智能问答功能。项目采用微服务架构，包含 Java SpringBoot 后端、React 前端和 Python AI 服务模块，为传统医疗系统提供智能化升级方案。

## 📌 项目架构

本项目由三大核心模块组成：

### 1. medical-ai-gateway（Python AI 智能网关）
- **语言**: Python 3.x
- **核心框架**: 
  - LangChain - AI Agent 框架
  - FastAPI - RESTful API 服务
  - Streamlit - Web UI 界面
- **主要功能**:
  - 基于 ReAct 模式的智能对话代理
  - RAG（检索增强生成）知识库问答
  - 危急症状自动拦截与预警
  - 流式响应（SSE）支持
  - Redis 会话管理与历史记录
  - 多模型降级机制（主备模型切换）

### 2. medical-his-backend/hospital/backend（Java 医院管理系统）
- **语言**: Java 17
- **框架**: Spring Boot 4.0.3
- **数据库**: MySQL 8.0
- **主要功能**:
  - 管理员后台管理（医生、患者、住院管理）
  - 患者用户中心（挂号、病历、报告查询）
  - JWT 身份认证与权限控制
  - RESTful API 接口服务
  - WebSocket 实时通信

### 3. medical-his-backend/hospital/Frontend（React 前端应用）
- **语言**: JavaScript / React
- **功能**: 
  - 管理员后台管理界面
  - 患者用户交互界面
  - 响应式设计，适配多端设备
 
  - <img width="991" height="1098" alt="616b40633e578ed7c6b9662ded1d6af9" src="https://github.com/user-attachments/assets/7474146c-5bc3-4345-aa6f-75564a362be1" />


---

## 🎯 核心功能特性

### 🔹 AI 智能问答系统

#### 1. 智能对话代理（ReAct Agent）
- 基于 LangChain 的 ReAct（Reasoning + Acting）模式
- 支持多轮对话上下文记忆
- 工具调用能力（RAG 检索、医院推荐等）
- 中间件监控与日志记录

#### 2. RAG 知识库问答
- 向量数据库存储（ChromaDB）
- 文档检索与相似度匹配
- 基于参考资料的智能总结
- 支持医学文献、常见症状等知识库

#### 3. 危急症状拦截
- **关键词检测**: 胸痛、呼吸困难、昏迷等紧急症状
- **语义分析**: 通过 LLM 智能判断危重症
- **自动预警**: 触发时给出就医建议和急救指导
- **双重保障**: 关键词 + 语义双重拦截机制

#### 4. 流式响应（SSE）
- Server-Sent Events 实时推送
- 打字机效果展示
- 降低首字延迟，提升用户体验

#### 5. 会话管理
- Redis 持久化存储对话历史
- 会话 TTL 自动过期（默认 7 天）
- 多会话并发支持
- 会话标题自动生成

### 🔹 医院管理系统

#### 管理员端功能
- ✅ 医生信息管理（增删改查）
- ✅ 患者入院/出院管理
- ✅ 工作台实时监控
- ✅ 在岗医生查看
- ✅ 在院患者列表
- ✅ 待出院患者管理
- ✅ 数据统计与报表
- ✅ 权限分级管理

#### 患者端功能
- ✅ 在线挂号预约
- ✅ 个人病历查询
- ✅ 住院记录查看
- ✅ 检查报告获取
- ✅ 个人信息管理

---

## 🚀 快速开始

### 环境要求

- **Python**: 3.9+
- **Java**: 17+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **Redis**: 5.0+

### 1. 配置环境变量

创建 `.env` 文件或设置系统环境变量：

