# AgentProject - 智能医疗 AI 系统

## 项目简介

AgentProject 是一套**前后端分离 + AI 智能服务**的综合医疗管理系统，包含医院业务（HMS）、患者门户与基于 RAG / Agent 的智能问答。仓库内为**多模块单体仓库**：Java Spring Boot 后端、Vite + React 前端、Python AI 网关，以及可选的 Docker 基础设施（Elasticsearch、Redis、Kafka、MinIO）。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `medical-his-backend/hospital/backend` | HMS 后端：REST、JWT、WebSocket、JPA/MySQL；调用 AI 网关；知识库分片上传、Kafka 异步入库、MinIO、Redis；审计日志等 |
| `medical-his-backend/hospital/Frontend/Frontend` | HMS 前端：Vite 7 + React 19 + Tailwind CSS 4 + React Router 7 |
| `medical-ai-gateway` | AI 网关：FastAPI（`agentApi`）、ReAct 风格 Agent、RAG（Elasticsearch 向量 + BM25 混合检索）、Redis 会话 |
| `docker/` | Elasticsearch 8.12 自建镜像（内置 IK 中文分词） |
| `docker-compose.yml` | 本地一键启动：Elasticsearch、Redis、Kafka（KRaft 单节点）、MinIO |
| `elasticsearch-analysis-ik-8.12.2.zip` | IK 插件包，供 ES 镜像构建使用（勿将含密钥的环境提交入库） |

子模块说明：

- [medical-his-backend/hospital/backend/README.md](medical-his-backend/hospital/backend/README.md) — 后端 API
- [medical-his-backend/hospital/Frontend/README.md](medical-his-backend/hospital/Frontend/README.md) — 前端

## 项目架构

### 1. medical-ai-gateway（Python AI 智能网关）

- **语言**: Python 3.9+
- **核心**: LangChain 生态、FastAPI（`medical-ai-gateway/agentApi`）、可选 Streamlit（`app.py`）
- **能力**: ReAct 对话、RAG 知识问答、危急症状拦截、SSE 流式输出、Redis 会话与历史、多模型降级（见 `config/agent.yaml` 等）

### 2. medical-his-backend/hospital/backend（Java HMS）

- **语言**: Java 17
- **框架**: Spring Boot 4.0.3
- **持久化**: MySQL 8
- **集成**: Spring Kafka、Spring Data Redis、MinIO SDK；HTTP 调用 AI 网关（`ai.fastapi.url`）
- **能力**: 管理端与患者端业务 API、JWT、WebSocket、SpringDoc OpenAPI；知识库文件管线；审计日志与定时清理

### 3. medical-his-backend/hospital/Frontend/Frontend（前端）

- **栈**: Vite、React 19、Tailwind CSS 4
- **能力**: 管理后台、患者门户、响应式布局

### 4. 系统关系（示意）

```text
浏览器 → Vite 前端 → HMS 后端 (:8081) → MySQL
                    ↘ AI 网关 (:8000) → 模型 + RAG(Elasticsearch)
知识库: 分片/合并 → MinIO → Kafka → 异步解析入库 → ES 索引
会话/分片协调: Redis
```

### 5. 架构图

<img width="991" height="1098" alt="系统架构图" src="https://github.com/user-attachments/assets/7474146c-5bc3-4345-aa6f-75564a362be1" />

---

## 核心功能特性

### AI 智能问答

1. **ReAct Agent**：多轮上下文、工具调用（RAG 等）、中间件与日志  
2. **RAG**：以 **Elasticsearch** 为主（向量字段 + IK 分词 + BM25 混合权重，见 `medical-ai-gateway/config/elasticsearch.yaml`）；仓库中另有 `config/chroma.yaml` 等与 Chroma 相关的配置入口，实现以 ES 为准  
3. **危急症状拦截**：关键词 + 语义双重判断，提示就医与急救信息  
4. **SSE**：流式推送，降低首字延迟  
5. **会话**：Redis 存储历史、TTL、多会话（具体以 `config/redis.yaml` 与代码为准）

### 医院管理系统

**管理端**：医生/科室与 ward、患者入出院、工作台与统计、权限分级；知识库文件管理；审计日志查询（以当前路由与页面为准）。

**患者端**：挂号、病历与住院记录、检查报告、个人信息等。

---

## 快速开始

### 环境要求

| 组件 | 版本建议 |
|------|-----------|
| Python | 3.9+ |
| Java | 17 |
| Node.js | 18+（与 Vite 7 兼容） |
| MySQL | 8.0+ |
| Redis / Kafka / MinIO / ES | 使用 Docker Compose 时由 compose 提供 |

### 1. 基础设施（可选，推荐用于知识库与 RAG 全链路）

在项目根目录：

```bash
docker compose up -d
```

默认端口（见 `docker-compose.yml`）：

- Elasticsearch：**9200**
- Redis：**6379**
- Kafka：**9092**（容器内 broker 间 **19092**）
- MinIO API：**9000**，控制台：**9001**（默认 `minioadmin` / `minioadmin`，仅本地）

ES 镜像通过 `docker/elasticsearch-ik/Dockerfile` 构建，内置 **IK 中文分词**，与网关 `elasticsearch.yaml` 中 `text_analyzer: ik_max_word` 一致。

### 2. 配置环境变量与密钥

创建 `.env` 或在系统中导出变量，**勿**将真实 API Key、数据库口令提交到 Git。常见项包括：

- 大模型与网关所需的环境变量（以 `medical-ai-gateway` 内读取方式为准）
- `DB_USERNAME` / `DB_PASSWORD`：覆盖 MySQL 账号（后端 `application.properties` 默认 `root` / `1234`）
- `REDIS_HOST` / `REDIS_PORT`、`KAFKA_BOOTSTRAP`、`MINIO_*`：与 compose 或自建集群一致

### 3. MySQL

创建或使用库 `hospital_management`（JDBC 中可 `createDatabaseIfNotExist=true`，仍以运维规范为准）。首次启动后端可由 JPA `ddl-auto` 建表（默认 `update`，生产请改为迁移方案）。

### 4. 启动 HMS 后端

```bash
cd medical-his-backend/hospital/backend
# Linux/macOS:
./mvnw spring-boot:run
# Windows:
mvnw.cmd spring-boot:run
```

默认端口 **8081**。OpenAPI（SpringDoc）启动后可在浏览器访问 Swagger UI（路径以 springdoc 默认配置为准）。

### 5. 启动前端

```bash
cd medical-his-backend/hospital/Frontend/Frontend
npm install
npm run dev
```

### 6. 启动 AI 网关

```bash
cd medical-ai-gateway
# 安装依赖后，按项目习惯启动 FastAPI，例如：
# uvicorn agentApi.main:app --host 0.0.0.0 --port 8000
```

确保后端 `application.properties` 中 `ai.fastapi.url` 与网关实际地址一致（默认 `http://localhost:8000`）。

---

## 后端配置要点

文件：`medical-his-backend/hospital/backend/src/main/resources/application.properties`

| 配置项 | 含义 |
|--------|------|
| `server.port` | 默认 `8081` |
| `spring.datasource.*` | MySQL 连接；可用 `DB_USERNAME` / `DB_PASSWORD` |
| `jwt.secret` / `jwt.expiration` | JWT；生产必须替换强密钥 |
| `ai.fastapi.url` | AI 网关基址 |
| `ai.gateway.*` | 调用网关超时与重试 |
| `spring.data.redis.*` | Redis（分片上传 bitmap 等） |
| `spring.kafka.*` | Kafka 消费/生产（知识库异步入库） |
| `minio.*` | 对象存储 endpoint 与凭据 |
| `audit.log.cleanup.*` | 审计日志定时清理策略 |

---

## 开发与贡献

- 大文件、临时图、本地 zip 与 `.env` 建议加入 `.gitignore`，避免误提交。  
- 子模块许可证见各自目录中的 `LICENSE`（如有）。
