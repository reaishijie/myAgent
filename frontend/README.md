# Agent RAG Frontend

React + Vite 管理控制台和外站 Widget 静态资源。

## 功能

- 管理控制台：配置 API Base URL 和后台口令、创建知识库、上传文件或粘贴文本/Markdown 入库、按分类筛选/分页展示文档、配置 Bot/Widget、复制一行 script、测试流式问答并查看 sources。
- Widget 聊天页：`/widget-chat?widgetId=...`，由 iframe 加载，默认请求同源 `/api`，展示 header、bot name/avatar、欢迎消息、消息时间和流式回答。
- SDK 脚本：`public/widget.js`，外站只需粘贴一行 `<script>` 即可生成悬浮入口和 iframe。

## 本地开发

```bash
bun install
bun run dev
```

默认 Vite 地址通常是 `http://localhost:5173/`。打开控制台后填写：

- API Base URL：后端 API 地址，例如 `http://localhost:9889/api`
- 后台口令 / API Key：后端 `.env` 中的 `ADMIN_API_KEY`

## 构建与验证

```bash
bun run lint
bun run build
bun test
```

端到端浏览器验收（会启动 mock OpenAI provider、真实后端和 Vite 前端）：

```bash
LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu \
NO_PROXY=127.0.0.1,localhost \
bun run test:e2e
```

`test:e2e` 需要本地 PostgreSQL/pgvector 数据库可通过后端 `DATABASE_URL` 访问；脚本默认使用 `postgres://postgres:123456@localhost:5432/agent-rag`。

## 外站接入

在管理控制台创建 Widget 后复制生成的一行代码，例如：

```html
<script src="https://your-console-origin/widget.js" data-widget-id="YOUR_WIDGET_ID" defer></script>
```

脚本会自动创建 Shadow DOM 悬浮按钮和 iframe 聊天窗口。默认请求前端同源 `/api`，适合前端服务或网关代理到后端。只有跨域部署且没有同源代理时，才需要显式添加 `data-api-base-url="https://your-api-origin/api"`。
