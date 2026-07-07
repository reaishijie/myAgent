# hono-agent

基于 `Bun + Hono + Prisma + PostgreSQL` 的 TypeScript 后端服务，支持部署到阿里云函数计算 FC 自定义运行时和 Cloudflare Workers。

当前已实现：

- 用户注册接口
- 用户查询接口
- Prisma Schema 管理与迁移
- 知识库、文档、分片、Widget/Bot、会话和消息数据模型
- 管理端 API Key 保护的知识库、文档上传和 Widget 配置接口
- txt、md、PDF、docx 基础文本解析、入库、embedding 和混合检索
- 基于知识库隔离的普通/流式 RAG 问答，返回 sources 供调试
- React 管理控制台：创建知识库、上传文件或粘贴文本/Markdown 入库、按分类筛选/分页展示文档、配置 Widget、复制嵌入代码、测试问答
- 外站一行 `<script>` 接入的 iframe 聊天窗口，支持公开跨域配置、流式聊天和消息持久化
- 阿里云函数计算 FC 部署配置
- Cloudflare Workers 部署配置
- GitHub Actions 手动选择部署目标

> MVP 边界：当前版本不包含组织多租户、计费、完整用户权限、OCR/扫描件识别、复杂主题系统或域名白名单强制校验。

## 环境要求

- Bun `>= 1.3`
- PostgreSQL `>= 14`
- Serverless Devs `s >= 3`，仅 FC 部署需要
- Wrangler，已作为项目 dev dependency 安装，仅 Cloudflare 部署需要

## 本地开发

安装依赖：

```bash
bun install
```

创建环境变量文件：

```bash
cp .env.example .env
```

最小本地配置：

```env
PORT='9889'
DATABASE_URL='postgres://postgres:root123456@127.0.0.1:5432/agent-rag'
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

`ADMIN_API_KEY` 用于保护管理端接口。管理请求可通过 `x-admin-api-key: <key>` 或 `Authorization: Bearer <key>` 访问；公开 Widget 配置和聊天接口不需要该口令。

生成 Prisma Client：

```bash
bun run db:generate
```

将 schema 推送到开发数据库：

```bash
bun run db:push
```

启动 Bun 服务：

```bash
bun run dev
```

启动 React 管理控制台：

```bash
cd frontend
bun install
bun run dev
```

控制台中填写后端 API Base URL（例如 `http://localhost:9889/api`）和 `ADMIN_API_KEY`，即可创建知识库、上传 `txt/md/pdf/docx`、配置 Widget 并复制接入脚本。

默认访问地址：

```text
http://localhost:9889
```

健康检查：

```bash
curl http://localhost:9889/
```

运行 Cloudflare Workers 本地开发服务：

```bash
bun run dev:cf
```

## 常用命令

```bash
bun run dev              # 启动 Bun 本地服务
bun run dev:cf           # 启动 Wrangler 本地 Worker
bun test                 # 运行测试
bun run db:generate      # 生成 Prisma Client
bun run db:push          # 同步 schema 到开发数据库
bun run db:migrate:dev   # 创建并应用开发迁移
bun run db:migrate:deploy # 应用生产迁移
bun run build:fc         # 构建 FC 部署产物 dist/index.js
bun run deploy:cf        # 部署到 Cloudflare Workers
```

## 数据库操作

开发环境可以直接同步 schema：

```bash
bun run db:push
```

需要 migration 时：

```bash
bun run db:migrate:dev
```

生产环境部署前执行：

```bash
bun run db:migrate:deploy
```

说明：

- Prisma 7 的数据库连接地址通过 `prisma.config.ts` 管理。
- 应用启动时只做数据库连通性检查，不在运行时自动执行迁移。
- 部署 FC 或 Cloudflare 前，应先确认目标数据库 schema 已更新。

## 主要接口

根路径：

```http
GET /
```

返回示例：

```json
{
  "code": 200,
  "status": "ok",
  "message": "后端服务正常运行！"
}
```

注册用户：

```http
POST /api/users/register
Content-Type: application/json
```

请求示例：

```json
{
  "username": "xiaohui",
  "password": "123456",
  "email": "xiaohui@example.com",
  "nickname": "小灰"
}
```

查询用户：

```http
GET /api/users/:username
```

管理端创建知识库（需要后台口令）：

```http
POST /api/admin/knowledge-bases
x-admin-api-key: <ADMIN_API_KEY>
Content-Type: application/json
```

上传文档到知识库（需要后台口令，支持文件 `txt/md/pdf/docx` 或直接提交文本/Markdown，可选 `category` 分类字段）：

```http
POST /api/rag/documents/upload
x-admin-api-key: <ADMIN_API_KEY>
Content-Type: multipart/form-data
```

管理端按知识库测试流式问答（需要后台口令，可选 `category` 只检索指定分类）：

```http
POST /api/rag/query/stream
x-admin-api-key: <ADMIN_API_KEY>
Content-Type: application/json
Accept: text/event-stream
```

公开读取 Widget 配置：

```http
GET /api/widgets/:widgetId/config
```

公开 Widget 聊天：

```http
POST /api/chat/sessions
POST /api/chat/sessions/:sessionId/messages/stream
```

外站一行脚本接入示例：

```html
<script src="https://your-console-origin/widget.js" data-widget-id="YOUR_WIDGET_ID" defer></script>
```

默认情况下，Widget iframe 会请求前端同源的 `/api`，适合通过前端服务或网关代理到后端。只有跨域部署且没有同源代理时，才需要显式覆盖 API 地址：

```html
<script src="https://your-console-origin/widget.js" data-widget-id="YOUR_WIDGET_ID" data-api-base-url="https://your-api-origin/api" defer></script>
```

## 项目结构

```text
prisma/                       Prisma schema 与 migrations
src/app.ts                    Hono 应用构建
src/index.ts                  Bun 服务入口
src/worker.ts                 Cloudflare Workers 入口
src/core/                     响应格式和业务异常
src/db/                       Prisma Client 和数据库启动检查
src/middleware/               中间件
src/routes/                   路由定义
src/services/                 业务逻辑
src/utils/                    工具函数
.github/workflows/deploy.yaml GitHub Actions 部署工作流
bootstrap                     FC 自定义运行时启动脚本
s.yaml                        Serverless Devs FC 部署配置
wrangler.jsonc                Cloudflare Workers 配置
```

## GitHub Actions 部署

项目提供 `Deploy` workflow：

- `push` 到 `main` 默认部署到阿里云函数计算 FC。
- 手动触发 `workflow_dispatch` 时可以选择 `fc` 或 `cloudflare`。

在 GitHub 仓库中配置 Repository Secrets：

```text
BUN_LAYER_ARN
DATABASE_URL
ALIBABA_CLOUD_ACCESS_KEY_ID
ALIBABA_CLOUD_ACCESS_KEY_SECRET
ALIBABA_CLOUD_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

其中：

- 部署 `fc` 需要 `BUN_LAYER_ARN`、`DATABASE_URL`、`ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`。
- `ALIBABA_CLOUD_ACCOUNT_ID` 在本地可能可由 Serverless Devs 自动获取，但 CI 中建议显式配置，避免交互式失败。
- 部署 `cloudflare` 需要 `DATABASE_URL`、`CLOUDFLARE_API_TOKEN`。
- `CLOUDFLARE_ACCOUNT_ID` 通常建议配置，避免 Wrangler 无法推断账号。

手动部署 Cloudflare：

```text
Actions -> Deploy -> Run workflow -> target 选择 cloudflare
```

手动部署 FC：

```text
Actions -> Deploy -> Run workflow -> target 选择 fc
```

## 部署到阿里云函数计算 FC

当前项目使用：

- `custom.debian11`
- HTTP Trigger
- Bun Layer + `dist/index.js`
- Serverless Devs `fc3` 组件

### 1. 构建业务代码

```bash
bun run build:fc
```

### 2. 打包 Bun Layer

```bash
chmod +x ./scripts/build-bun-layer.sh
./scripts/build-bun-layer.sh 1.3.2 bun-layer.zip
```

### 3. 创建 FC Layer

在阿里云函数计算控制台创建 Layer：

- 地域：与 `s.yaml` 中 `vars.region` 保持一致，当前为 `cn-hongkong`
- 上传文件：`bun-layer.zip`
- 兼容运行时：`custom.debian11`

### 4. 配置本地环境变量

`s deploy` 不会自动读取项目中的 `.env`。如果变量写在 `.env`，部署前先导入：

```bash
set -a
source .env
set +a
```

最少需要：

```env
BUN_LAYER_ARN='你的 FC Bun Layer ARN'
DATABASE_URL='postgres://用户名:密码@数据库地址:5432/库名'
```

### 5. 配置阿里云凭证

```bash
s config add \
  -a default \
  --AccessKeyID '你的 AccessKeyID' \
  --AccessKeySecret '你的 AccessKeySecret' \
  -f
```

如果 Serverless Devs 无法自动获取 AccountID，则显式传入：

```bash
s config add \
  -a default \
  --AccessKeyID '你的 AccessKeyID' \
  --AccessKeySecret '你的 AccessKeySecret' \
  --AccountID '你的阿里云 AccountID' \
  -f
```

### 6. 部署

```bash
s deploy -y
```

## 部署到 Cloudflare Workers

Cloudflare 配置文件是 `wrangler.jsonc`，入口文件是 `src/worker.ts`。

### 1. 登录或配置 token

交互式登录：

```bash
bunx wrangler login
```

或使用 API Token：

```bash
export CLOUDFLARE_API_TOKEN='你的 Cloudflare API Token'
export CLOUDFLARE_ACCOUNT_ID='你的 Cloudflare Account ID'
```

### 2. 设置 Worker 运行时数据库密钥

```bash
bunx wrangler secret put DATABASE_URL
```

按提示输入目标 PostgreSQL 连接串。

### 3. 部署

```bash
bun run deploy:cf
```

## 部署相关文件

- `s.yaml`
- `bootstrap`
- `scripts/build-bun-layer.sh`
- `.fcignore`
- `wrangler.jsonc`
- `.github/workflows/deploy.yaml`

## 常见问题

### 注册接口卡在用户查重

表现：

- 日志停在“开始检查用户是否已存在”

原因通常是：

- PostgreSQL 不可达
- `DATABASE_URL` 写错
- 本地 `localhost` 解析或 Docker 端口问题

建议：

- 优先使用 `127.0.0.1`
- 确保数据库允许当前运行环境访问

### `s deploy` 报 `Not found access: default`

`s.yaml` 中配置了：

```yaml
access: default
```

需要先创建名为 `default` 的 Serverless Devs access：

```bash
s config add \
  -a default \
  --AccessKeyID '你的 AccessKeyID' \
  --AccessKeySecret '你的 AccessKeySecret' \
  -f
```

### `s deploy` 报环境变量不存在

确保 `s.yaml` 中使用的是：

```yaml
${env(BUN_LAYER_ARN)}
${env(DATABASE_URL)}
```

不要写成：

```yaml
${env.BUN_LAYER_ARN}
${env.DATABASE_URL}
```

### Layer 与函数运行时不兼容

如果报：

```text
runtime: custom.debian11 is not supported by layer
```

说明 Layer 创建时选错了兼容运行时。重新创建 Layer，并选择 `custom.debian11`。

### GitHub Actions 中 secret 为空

当前 workflow 读取的是 Repository Secrets。请在 GitHub 仓库中进入：

```text
Settings -> Secrets and variables -> Actions -> Repository secrets
```

不要只配置到 Environment secrets，除非 workflow job 同时声明对应的 `environment`。
