# AgentProject - 医疗 HIS + AI 智能助手平台

> 一个面向医院场景的全栈项目：
> **Java HIS（业务与权限） + Python AI 网关（智能编排） + React 前端（管理端/患者端）**
> 实现了从“症状咨询 -> 医生推荐 -> 预约挂号”的真实业务闭环。

---

## 目录

- [1. 项目速览](#1-项目速览)
- [2. 仓库结构](#2-仓库结构)
- [3. 系统架构与分工](#3-系统架构与分工)
- [4. 核心功能（重点）](#4-核心功能重点)
- [5. 关键业务流程](#5-关键业务流程)
- [6. API 概览](#6-api-概览)
- [7. 环境依赖与配置](#7-环境依赖与配置)
- [8. 本地启动（5 步）](#8-本地启动5-步)
- [9. 可观测性与稳定性设计](#9-可观测性与稳定性设计)
- [10. 常见问题 FAQ](#10-常见问题-faq)


---

## 1. 项目速览

### 这是一个什么项目？

`AgentProject` 是医疗场景下的 AI 增强系统，特点是：

- AI 能理解自然语言医疗诉求
- AI 不“空谈”，会调用真实医院业务接口
- 关键动作（如预约）具备流程约束与权限校验
- 支持多轮对话记忆与跨会话上下文连续

### 解决了什么问题？

- 纯 LLM 在预约场景中不稳定、不可控的问题
- 医疗场景中“权限一致性”和“真实数据可信性”问题
- 多轮复杂对话中的上下文丢失问题

---

## 2. 仓库结构

```text
AgentProject
├─ medical-his-backend/
│  └─ hospital/
│     ├─ backend/                  # Java Spring Boot HIS 后端
│     └─ Frontend/Frontend/        # React 前端
├─ medical-ai-gateway/             # Python FastAPI + LangChain Agent
├─ docker/                         # Elasticsearch(含IK)镜像等
├─ docker-compose.yml              # Redis / ES / Kafka / MinIO
└─ README.md
```

---

## 3. 系统架构与分工

### 架构关系（简化）

```text
浏览器 -> React 前端 -> Java HIS 后端(:8081) -> MySQL
                        -> Python AI 网关(:8000) -> 模型 + RAG(ES)
Redis: 会话与状态
Kafka + MinIO: 知识库异步入库链路
```

### 职责划分（核心原则）

- **Java HIS：可信执行层**
  - 业务真值（医生/患者/预约）
  - JWT 鉴权与权限控制
  - 最终业务落库
- **Python AI 网关：智能编排层**
  - 语义理解、工具选择、流程编排
  - 状态机控制预约流程
  - 记忆与 RAG 检索
- **前端：交互层**
  - 管理端和患者端页面
  - 会话展示、流式回复展示

---

## 4. 核心功能（重点）

## 4.1 预约智能体架构：语义路由 + 状态机 + 轻量模型抽槽

### 为什么这样设计？

纯 LLM 工具调用在交易型流程（预约）中容易出现：
- 意图误判
- 参数缺失却发起调用
- 行为不稳定、难调试

### 当前方案

1. **语义路由**：先判断是否预约意图
2. **状态机补槽**：必须收齐关键字段（患者、医生/症状、日期、时间）
3. **轻量模型抽槽**：从自然语言抽结构化参数，规则层安全兜底

### 效果

- 降低不必要的模型推理与工具误调用
- 提升流程确定性与可观测性
- 预约链路更稳定

---

## 4.2 医疗工具集（LangChain Tools）与真实业务回调

AI 网关封装了多个工具，例如：

- 按姓名查医生
- 按姓名查患者
- 拉取全院医生
- 按科室筛选医生
- 预约挂号

> 这些结果来自 Java 后端真实接口，不允许模型编造实体数据。

---

## 4.3 一站式链路：症状 -> 科室 -> 医生 -> 预约

系统可处理类似输入：

> “我头疼三天了，帮我约明天下午的医生”

执行链路：
1. 症状结构化总结
2. 推荐就诊科室
3. 匹配候选医生
4. 收集预约时间参数
5. 调用预约接口并返回结果

---

## 4.4 三级记忆架构（L1/L2/L3）

### L1 工作记忆
- 记录当前任务执行态（节点、临时参数、最近工具结果）
- 用于流程连续执行（如预约补槽）

### L2 会话记忆
- 保留最近消息窗口
- 超窗后做摘要压缩
- 同步更新用户画像（偏好、症状、风险、未闭环事项）

### L3 长期记忆
- 摘要向量化存入 ES
- 支持跨会话召回

### 门控检索策略
仅在特定场景触发长期记忆检索（如历史追问、L2不足、冷启动），降低无效查询与时延。

---

## 4.5 主备模型自动切换（高可用）

- 工厂模式统一主模型/备模型/Embedding 模型构建
- `with_fallbacks` 实现主模型异常自动降级到备模型
- 提升系统连续服务能力，减少因上游模型波动导致的失败

---

## 4.6 JWT Bearer Token 透传（跨服务权限一致）

目标：保证 AI 工具回调业务接口时仍携带用户身份。

流程：
1. Java 从请求中解析 JWT
2. Java 调 Python 时透传 `bearer_token`
3. Python 在当前请求上下文保存 token
4. 工具回调 Java 预约接口时自动带 `Authorization: Bearer ...`

价值：
- 避免匿名裸调业务接口
- 与院内权限体系一致
- 支持审计追踪

---

## 4.7 医疗安全策略

- 危急症状双重拦截（关键词 + 语义）
- 高风险场景引导急诊 / 120
- 医疗建议仅作辅助，关键业务动作以 HIS 结果为准

---

## 5. 关键业务流程

## 5.1 智能预约流程

1. 用户发起预约类请求
2. 语义路由识别预约意图
3. 进入状态机收集/补齐参数
4. 需要时根据症状推荐医生
5. 调用 Java 预约接口落库
6. 返回预约结果（编号/失败原因）

## 5.2 普通问答流程

1. 构建记忆上下文（L1/L2）
2. 按需触发 L3 检索
3. Agent 调用工具（RAG / 医疗查询）
4. 输出回答并写回会话记忆

---

## 6. API 概览

## Java -> Python（AI 网关）

- `POST /api/v1/chat/messages`
- `POST /api/v1/chat/stream`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/{sessionId}/history`

## Python 工具 -> Java（业务接口）

- `GET /api/v1/ai-assistant/searchDoctor`
- `GET /api/v1/ai-assistant/searchPatient`
- `GET /api/v1/ai-assistant/allDoctors`
- `POST /api/v1/ai-assistant/appointment`

---

## 7. 环境依赖与配置

## 7.1 依赖

- Python 3.9+
- Java 17
- Node.js 18+
- MySQL 8+
- Redis / Elasticsearch / Kafka / MinIO（可由 Docker 提供）

## 7.2 关键配置

### Python AI 网关

- 文件：
  - `medical-ai-gateway/config/agent.yaml`
  - `medical-ai-gateway/config/elasticsearch.yaml`
  - `medical-ai-gateway/config/redis.yaml`
- 环境变量：
  - `DEEPSEEK_API_KEY`
  - `DASHSCOPE_API_KEY`
  - `JAVA_BACKEND_URL`（默认 `http://localhost:8081`）

### Java 后端

- 文件：`medical-his-backend/hospital/backend/src/main/resources/application.properties`
- 重点项：
  - `spring.datasource.*`
  - `ai.fastapi.url`
  - `ai.gateway.*`
  - `spring.data.redis.*`

---

## 8. 本地启动（5 步）

## 1) 启动基础设施（推荐）

```bash
docker compose up -d
```

常用端口：
- ES `9200`
- Redis `6379`
- Kafka `9092`
- MinIO API `9000` / Console `9001`

## 2) 启动 Java 后端

```bash
cd medical-his-backend/hospital/backend
mvnw.cmd spring-boot:run
```

默认：`http://localhost:8081`

## 3) 启动 Python AI 网关

```bash
cd medical-ai-gateway
# pip install -r requirements.txt
uvicorn agentApi.main:app --host 0.0.0.0 --port 8000
```

默认：`http://localhost:8000`

## 4) 启动前端

```bash
cd medical-his-backend/hospital/Frontend/Frontend
npm install
npm run dev
```

## 5) 联调验证

- 前端进入 AI 助手页面发起提问
- 验证查询医生/预约流程是否可走通
- 观察 Java 与 Python 日志中的路由、状态机、工具调用记录

---

## 9. 可观测性与稳定性设计

### 关键监控点

- 路由命中与置信度
- 状态机节点迁移（收参/执行/完成）
- 工具调用成功率与状态码分布
- 模型 fallback 触发次数
- 会话记忆读写与检索触发率

### 稳定性策略

- 主备模型自动降级
- 超时、连接失败、401/403/500 分级兜底
- 记忆系统异常不阻塞主链路
- 明确用户侧可执行提示（而非静默失败）

---

## 10. 常见问题 FAQ

### Q1：为什么 AI 可以完成预约？
A：AI 负责流程编排，最终预约由 Java 业务接口执行并落库。

### Q2：为什么会出现 401/403？
A：预约接口需要有效 JWT 与权限，请在登录态下发起请求。

### Q3：为什么同时用 Redis 和 ES？
A：Redis 管会话/状态，ES 管知识检索与长期记忆召回。

### Q4：为什么不是纯 LLM？
A：医疗预约是交易型流程，必须可控、可审计、可回放。

---


本系统中的 AI 回答仅用于辅助信息与流程引导，不能替代专业医生诊断。
若出现紧急症状，请立即前往医院急诊或拨打急救电话。
