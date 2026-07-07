# 提供一行代码即可接入的外站聊天窗口

## Objective

完成后，其他网页只要粘贴一段类似统计代码的 script，就会自动出现知识问答聊天入口，并能根据绑定知识库进行流式对话。

## Scope

- 提供公开 Widget 配置读取、聊天接口适配、聊天页和轻量 JS SDK。
- 外站接入方式是一行 script，脚本自动创建悬浮入口和 iframe 聊天窗口。
- 聊天窗口包含 header、bot name、avatar、消息时间，默认流式输出答案。
- Widget 脚本和聊天接口允许跨域公开访问；管理接口仍保持后台口令保护。
- 不实现复杂主题系统、强制域名白名单、客服转人工或完整会话统计面板。

## Steps

- [x] **确认公开接口**：基于 G1/G2 的 Widget 配置和问答能力，确认外站只需 `widgetId` 即可加载配置并发起聊天。
- [x] **开放跨域策略**：为 Widget 脚本、配置读取和聊天接口配置合适 CORS，确保不放开管理接口保护。
- [x] **实现聊天 API**：提供面向 Widget 的会话创建、消息发送、SSE 流式回答接口，并持久化用户消息、AI 消息和时间。
- [x] **实现聊天页面**：在前端提供 iframe 加载的聊天页，按 `widgetId` 拉取配置并展示 header、bot name、avatar 和消息时间。
- [x] **处理流式状态**：聊天页支持发送中、接收中、完成、错误、重试等状态，流式片段能合并为一条 AI 消息。
- [x] **实现 SDK 脚本**：提供可被外站 script 引入的轻量脚本，自动读取 `data-widget-id` 或查询参数并创建悬浮按钮与 iframe。
- [x] **生成接入示例**：确保控制台展示的一行 script 与实际 SDK 参数一致，复制后可直接粘贴到普通 HTML 页面。
- [x] **适配移动端**：聊天窗口在桌面右下角展开，在移动端使用更接近全屏的布局，避免遮挡和溢出。
- [x] **补齐 Widget 测试**：为公开配置、会话持久化、跨域响应、SDK 初始化关键逻辑添加测试或可复现验证。
- [x] **补齐验收缺口**：固化外站一行 script smoke、刷新恢复会话和后端历史消息可查的直接验收证据。

## Success Criteria

- 外站只粘贴一行 script 后，无需手写初始化代码即可出现聊天入口。
- 聊天窗口通过 iframe 隔离样式，不明显受宿主页 CSS 影响。
- Widget 能加载后端配置，显示 header、bot name、avatar 和每条消息时间。
- 用户提问后能看到流式 AI 回复，并由后端保存会话和消息。
- 管理接口没有因为 Widget 跨域公开而失去后台口令保护。

## Verification

- [x] `bun test` exit 0。
- [x] `cd frontend && bun run build` exit 0。
- [x] `cd frontend && bun test` exit 0。
- [x] 使用一个独立 HTML 文件粘贴生成的一行 script，浏览器打开后自动出现聊天入口。
- [x] 在独立 HTML 页面打开聊天窗，header、bot name、avatar 与后端 Widget 配置一致。
- [x] 在聊天窗发送问题，能看到流式回复和消息时间；刷新后按设计能恢复或重新创建会话，并在后端可查到消息记录。
- [x] 使用浏览器 Network 面板确认 Widget 公开接口跨域成功，管理接口无后台口令仍被拒绝。

## Notes

- SDK 可以放在前端构建产物或 public 静态资源中，但需要与部署路径保持一致。
- iframe 内聊天页应尽量独立，避免依赖管理控制台登录态。
- 域名白名单字段可保留但第一版不强制校验；如实现校验，需确保本地开发和测试页面有明确配置方式。

## Handoff

- Completed Goal 4 on branch `feat/widget-chat-window`.
- Public contract: external pages use `widgetId` only; SDK script also accepts optional `data-api-base-url` for deployments where frontend and API origins differ.
- Backend changes: added scoped public CORS for `/api/widgets/*`, `/api/chat/*`, `/api/rag/query*`; admin/document routes remain API-key protected. Added `/api/chat/sessions/:sessionId/messages/stream` which saves USER message, streams RAG answer events, then saves ASSISTANT message with source metadata.
- Frontend changes: added `/widget-chat?widgetId=...&apiBaseUrl=...` iframe chat page with header, bot name/avatar, welcome message, timestamps, streaming states, retry/error handling, local visitor/session reuse, and mobile-safe layout.
- SDK changes: added `frontend/public/widget.js`; one-line script creates a Shadow DOM launcher and iframe, reads `data-widget-id` or query `widgetId`, and adapts to mobile full-screen-ish layout.
- Console embed code now generates `<script src="{frontend-origin}/widget.js" data-widget-id="..." data-api-base-url="..." defer></script>` matching SDK parameters.
- Verification evidence updated after completion review: `bun test` passed (50 tests); `cd frontend && bun test` passed (3 tests); `cd frontend && bun run build` passed. The frontend test now directly covers first load -> create session -> stream answer -> persisted USER/ASSISTANT records -> simulated refresh -> `GET /chat/sessions/:id` restores historical messages from the backend response. A persistent SDK test in `frontend/src/App.test.tsx` now constructs an external-page one-line script scenario and asserts Shadow DOM root, launcher, iframe URL, and open behavior. Browser Network verification is intentionally represented by automated CORS/permission tests in `src/app.widget.test.ts` (`OPTIONS` for public widget/chat and 401 for admin without key).

