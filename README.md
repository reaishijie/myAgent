# Agent RAG

Agent RAG 是一个基于 `Bun + Hono + Prisma + PostgreSQL/pgvector + React + Vite` 的知识库问答与网站 Widget 项目。项目采用前后端分离目录结构，后端提供 RAG、知识库、文档入库、Widget 和会话 API，前端提供管理控制台与可嵌入聊天窗口。

## 当前能力

- 后端：Bun + Hono TypeScript API 服务。
- 数据库：Prisma 7 + PostgreSQL，向量字段基于 `pgvector`。
- RAG：文档切分、embedding 入库、向量/全文混合检索、普通与 SSE 流式问答。
- 文档入库：支持粘贴文本/Markdown，也支持上传 `txt`、`md`、`pdf`、`docx`。
- 知识库：支持多知识库隔离、文档分类、分页列表、内容去重。
- Widget：每个知识库可配置站点聊天机器人，支持标题、机器人名称、头像、欢迎语、系统提示词和启用状态。
- 聊天会话：公开 Widget 配置、创建会话、保存消息、流式回复并持久化消息。
- 管理端：React 控制台支持连接后台口令、创建知识库、文档入库、Widget 配置、复制嵌入代码和测试问答。
- 静态资源：后端可通过 `STATIC_ROOT` 直接托管前端构建产物。
- 部署：支持本地开发、Docker 快速部署包、阿里云函数计算 FC、Cloudflare Workers。

> 当前版本仍属于轻量 MVP：未包含组织多租户、计费、完整用户权限、OCR/扫描件识别、复杂主题系统或域名白名单强制校验。

## 项目结构

```text
.
├── backend/                 # Bun + Hono + Prisma 后端
│   ├── prisma/              # Prisma schema 与迁移
│   ├── scripts/             # 构建与本地 mock provider 脚本
│   └── src/
│       ├── core/            # 响应与业务异常封装
│       ├── db/              # Prisma 初始化与数据库检查
│       ├── middleware/      # 管理口令、请求日志等中间件
│       ├── routes/          # API 路由
│       ├── services/        # RAG、知识库、Widget、聊天等业务逻辑
│       └── utils/           # logger、文本切分、密码工具等
├── frontend/                # React + Vite 管理控制台与 Widget UI
├── build.sh                 # 生成 Docker 快速部署包
└── agentRagQuickDeploy/     # build.sh 生成的部署目录，默认不需要手动维护
```

## 环境要求

- Bun `>= 1.3`
- PostgreSQL `>= 14`，推荐使用带 `pgvector` 的镜像/实例
- Node/浏览器环境用于前端调试
- Docker 与 Docker Compose（仅快速部署需要）
- Serverless Devs `s >= 3`（仅阿里云 FC 部署需要）
- Wrangler（仅 Cloudflare Workers 部署需要，已在后端 devDependencies 中声明）

## 后端本地开发

```bash
cd backend
bun install
cp .env.example .env
```

最小环境变量示例：

```env
PORT='9889'
DATABASE_URL='postgres://postgres:root123456@localhost:5432/agent-rag'

OPENAI_CHAT_API_KEY=''
OPENAI_CHAT_BASE_URL='https://api.openai.com/v1'
OPENAI_CHAT_MODEL=''

OPENAI_EMBEDDING_API_KEY=''
OPENAI_EMBEDDING_BASE_URL='https://api.openai.com/v1'
OPENAI_EMBEDDING_MODEL='text-embedding-3-small'

RAG_CHUNK_SIZE='800'
RAG_CHUNK_OVERLAP='120'
RAG_TOP_K='5'

ADMIN_API_KEY='change-me-in-local-dev'
```

初始化数据库并启动：

```bash
cd backend
bun run db:generate
bun run db:push          # 开发环境可直接同步 schema
bun run dev
```

默认后端地址：

```text
http://localhost:9889
```

健康检查：

```bash
curl http://localhost:9889/health
```

## 前端本地开发

```bash
cd frontend
bun install
bun run dev
```

如需指定后端 API 地址，可设置：

```bash
VITE_API_BASE_URL='http://localhost:9889/api' bun run dev
```

管理控制台中填写与后端一致的 `ADMIN_API_KEY` 后即可使用知识库、文档、Widget 和问答测试功能。

## 常用命令

后端：

```bash
cd backend
bun run dev               # Bun 本地服务
bun run dev:cf            # Wrangler 本地 Worker
bun test                  # 后端测试
bun run db:generate       # 生成 Prisma Client
bun run db:push           # 同步 schema 到开发数据库
bun run db:migrate:dev    # 创建并应用开发迁移
bun run db:migrate:deploy # 应用生产迁移
bun run build:fc          # 构建 FC/Serverless 入口 dist/index.js
bun run build:serverless  # 构建 Node serverless 入口 dist/index.js
bun run deploy:cf         # 部署 Cloudflare Workers
```

前端：

```bash
cd frontend
bun run dev               # Vite 开发服务
bun run lint              # ESLint
bun run build             # TypeScript + Vite 构建
bun test                  # 前端单测
bun run test:e2e          # 启动 mock provider、后端、前端并运行 Playwright
```

整包快速构建：

```bash
./build.sh
```

该脚本会构建前端与后端，并在 `agentRagQuickDeploy/` 中生成 Dockerfile、docker-compose、静态资源、后端 dist 和 Prisma 迁移。

## Docker 快速部署

生成部署包：

```bash
./build.sh
```

启动：

```bash
cd agentRagQuickDeploy
cp .env.docker.example .env.docker
# 修改 ADMIN_API_KEY、数据库密码、模型服务配置等

docker compose --env-file .env.docker up -d --build
```

访问：

- 控制台：<http://localhost:9889/>
- 健康检查：<http://localhost:9889/health>
- API 前缀：<http://localhost:9889/api>

## API 概览

所有业务 API 默认挂载在 `/api` 下。管理端接口需要后台口令，可通过以下任一方式传递：

```http
x-admin-api-key: <ADMIN_API_KEY>
Authorization: Bearer <ADMIN_API_KEY>
```

公开 Widget 配置与聊天接口不需要管理口令。

### 基础接口

```http
GET /
GET /health
```

### 用户接口

```http
POST /api/users/register
GET /api/users/:username
```

### 管理端知识库与 Widget

```http
GET  /api/admin/knowledge-bases
POST /api/admin/knowledge-bases
GET  /api/admin/knowledge-bases/:id
GET  /api/admin/knowledge-bases/:id/widgets
POST /api/admin/widgets
GET  /api/admin/widgets/:widgetId
PATCH /api/admin/widgets/:widgetId
```

创建知识库示例：

```bash
curl -X POST http://localhost:9889/api/admin/knowledge-bases \
  -H 'content-type: application/json' \
  -H 'x-admin-api-key: change-me-in-local-dev' \
  -d '{"name":"产品知识库","description":"用于官网客服问答"}'
```

### 文档入库与 RAG 问答

```http
GET  /api/rag/documents
POST /api/rag/documents
POST /api/rag/documents/plain?title=...&knowledgeBaseId=...&category=...
POST /api/rag/documents/upload
POST /api/rag/query
POST /api/rag/query/stream
```

上传文档示例：

```bash
curl -X POST 'http://localhost:9889/api/rag/documents/upload' \
  -H 'x-admin-api-key: change-me-in-local-dev' \
  -F 'knowledgeBaseId=1' \
  -F 'category=FAQ' \
  -F 'file=@./docs/example.md'
```

问答示例：

```bash
curl -X POST http://localhost:9889/api/rag/query \
  -H 'content-type: application/json' \
  -H 'x-admin-api-key: change-me-in-local-dev' \
  -d '{"knowledgeBaseId":1,"question":"这个产品如何接入？","topK":5}'
```

### 公开 Widget 与聊天

```http
GET  /api/widgets/:widgetId/config
POST /api/chat/sessions
GET  /api/chat/sessions/:sessionId
POST /api/chat/sessions/:sessionId/messages
POST /api/chat/sessions/:sessionId/messages/stream
```

站点嵌入示例：

```html
<script src="https://your-domain.example/widget.js" data-widget-id="<widgetId>" defer></script>
```

本地一体化部署或 Docker 部署时，`widget.js` 由后端静态资源服务直接托管。

## 数据库与迁移说明

- Prisma schema 位于 `backend/prisma/schema.prisma`。
- 迁移文件位于 `backend/prisma/migrations/`。
- 开发环境可使用 `bun run db:push` 快速同步。
- 生产环境请使用 `bun run db:migrate:deploy` 应用迁移。
- 应用启动时只检查数据库连通性，不会自动创建开发迁移。
- 由于 `KnowledgeChunk.embedding` 使用 `vector(1536)`，目标数据库需要启用 `pgvector` 扩展。

## 测试

```bash
cd backend
bun test

cd ../frontend
bun test
bun run lint
bun run build
```

端到端测试：

```bash
cd frontend
bun run test:e2e
```

E2E 脚本会自动启动 mock OpenAI-compatible provider、后端和前端，并通过 Playwright 验证主要流程。

## 部署提示

- 不要提交 `.env`、云厂商密钥、数据库连接串、`node_modules/`、`dist/`、`.wrangler/`、`bun-layer.zip` 等敏感或生成文件。
- 暴露到公网前务必修改 `ADMIN_API_KEY`。
- 部署运行时需要配置 OpenAI-compatible chat 与 embedding 服务；embedding 模型维度需与数据库向量字段匹配。
- 如果希望后端托管前端静态资源，请将前端构建产物放到 `STATIC_ROOT` 指向的目录，并设置 `STATIC_ROOT=/path/to/public`。
