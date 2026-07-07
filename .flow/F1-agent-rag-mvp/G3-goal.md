# 提供可管理知识库和机器人的 React 控制台

## Objective

完成后，用户可以在浏览器里创建知识库、上传文档、配置聊天机器人、复制嵌入代码，并在管理端测试知识库问答效果。

## Scope

- 将 `frontend/` 从初始示例改造成轻量 SaaS 风格控制台。
- 覆盖知识库列表/创建、文档上传与列表、Widget/Bot 配置、嵌入代码展示、测试问答。
- 管理端通过后台口令/API Key 调用受保护接口。
- 不做复杂仪表盘、用户体系、组织管理、计费或完整主题系统。

## Steps

- [x] **清理示例页面**：移除 Vite 默认计数器和临时内容，建立控制台应用骨架与基础样式。
- [x] **封装接口客户端**：在前端封装 API base URL、后台口令输入/保存、统一请求错误处理和流式问答调用。
- [x] **实现口令入口**：提供简单后台口令配置入口，未配置时引导用户输入，避免管理请求裸奔失败。
- [x] **实现知识库管理**：展示知识库列表，支持创建知识库和选择当前知识库。
- [x] **实现文档上传**：支持 txt、md、pdf、docx 文件选择和上传，展示 loading、成功结果、错误提示和文档列表。
- [x] **实现 Bot 配置**：提供 header 标题、bot name、avatar、绑定知识库等配置表单，并能保存到后端。
- [x] **展示嵌入代码**：根据 Widget 配置生成一行 script 接入代码，提供复制按钮和必要说明。
- [x] **实现测试问答**：在控制台内对当前知识库提问，支持流式显示答案，并展示命中的 sources 片段。
- [x] **适配响应式布局**：让控制台在常见桌面宽度可用，窄屏下表单和列表不溢出。
- [x] **补齐前端验证**：修复 TypeScript、lint 和 build 问题，必要时为关键工具函数补测试。

## Success Criteria

- 用户不写接口请求也能完成知识库创建、文档上传、Bot 配置和测试问答。
- 上传和问答过程有明确 loading、成功和失败反馈。
- 嵌入代码由真实 Widget 配置生成，能交给 G4 的外站接入使用。
- 管理端测试问答能展示 sources，方便判断检索质量。
- UI 采用简洁 SaaS 控制台风格，不再保留默认 Vite 示例体验。

## Verification

- [x] `cd frontend && bun install` 后依赖安装正常。
- [x] `cd frontend && bun run build` exit 0。
- [x] `cd frontend && bun run lint` exit 0，或在 Handoff 中明确说明现有 lint 配置导致的非业务阻塞。
- [x] 人工打开前端页面，输入后台口令后能创建知识库并看到列表更新。（Playwright Chromium 真实浏览器连接真实后端验证通过）
- [x] 人工上传一个 txt 或 md 文档，页面显示处理结果和文档列表。（Playwright Chromium 上传 md 并看到文档列表与 `COMPLETED`）
- [x] 人工配置 Widget 后，页面显示包含 `widgetId` 的一行 script 代码。（Playwright Chromium 创建 Widget、看到 `data-widget-id=` 并验证复制到剪贴板）
- [x] 人工在测试问答区提问，能看到流式答案和 sources。（Playwright Chromium 经真实后端 + 本地 OpenAI-compatible provider 看到流式回答和 sources）

## Notes

- 前端技术栈为 Vite + React 19，优先使用轻量自实现样式，除非确有必要不要引入大型 UI 框架。
- 如果 API base URL 需要配置，可采用 Vite 环境变量，并考虑 `.env.example` 是否由执行 Goal 更新。
- 不要在前端硬编码真实密钥；后台口令仅保存在浏览器本地配置中用于管理请求。

## Handoff

完成：已将 `frontend/` 从示例页面改造成 React 控制台，包含后台口令/API Base URL 配置、知识库列表/创建/选择、文档上传、Bot/Widget 配置、嵌入 script 代码生成与复制、知识库流式问答测试和 sources 展示。新增 `frontend/src/api.ts` 统一处理 API envelope、管理口令 header、FormData 上传和 SSE 解析；新增 `frontend/src/styles.css` 提供轻量 SaaS 控制台样式与响应式布局；移除默认示例 Header 与 Vite/React 示例资产。

补充修复：验收反馈中“文档列表仅内存态”和“Widget 配置刷新后无法回显”属实，已补齐。后端新增 `GET /api/rag/documents?knowledgeBaseId=...` 受保护文档列表接口，返回文件信息、解析状态和 chunk 数；新增 `GET /api/admin/knowledge-bases/:id/widgets` 受保护 Widget 列表接口。前端选择知识库和刷新后会重新加载已有文档列表与最新 Widget，回填 Bot 表单，并持续显示包含真实 `widgetId` 的嵌入代码。

验证：`cd frontend && bun install` 通过并安装前端测试依赖；`cd frontend && bun run build` 通过；`cd frontend && bun run lint` 通过；`cd frontend && bun run test` 通过，DOM 集成测试覆盖保存后台口令、创建知识库、上传 md、显示文档列表、创建 Widget、生成含 `data-widget-id="widget-real-1"` 的 script、测试问答流式渲染 answer 和 sources。新增并通过 `bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts`，覆盖文档列表服务、Widget 按知识库列表服务、RAG 文档列表路由，以及现有上传/问答集成路径。已启动前端 dev server，`NO_PROXY=127.0.0.1,localhost curl -I http://127.0.0.1:5173/` 返回 200，页面地址为 `http://127.0.0.1:5173/`。首次直接 curl 命中环境代理返回 502，设置 `NO_PROXY` 后正常。

真实浏览器验收：已补齐 Playwright Chromium e2e。测试启动本地 OpenAI-compatible mock provider、真实后端进程和 Vite 前端，后端连接 Docker 中 `pgvector/pgvector` 的 `agent-rag` 数据库，并通过 `LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu` 注入本地下载的 Chromium 缺失库。`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 通过，覆盖浏览器中保存后台口令、创建知识库并看到列表更新、上传 md 并看到文档列表和 `COMPLETED`、创建 Widget 并看到含 `data-widget-id=` 的 script 且复制到剪贴板、测试问答并看到流式回答与 sources。

第 4 轮验收修复：反馈指出 Playwright 产物 `frontend/test-results/` 存在时 `cd frontend && bun run lint` 可能扫描测试输出并失败。已将 `test-results` 和 `playwright-report` 加入 `frontend/eslint.config.js` 的 `globalIgnores`。复验：`cd frontend && bun run lint` 通过；`cd frontend && bun run build` 通过；`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 通过；并在 `frontend/test-results/` 仍存在时再次运行 `cd frontend && bun run lint` 通过。

质量检查修复：反馈指出真实 e2e 偶发 `Failed to fetch`，创建知识库后新项未出现，页面仍绑定旧知识库。根因是页面加载时已有旧 localStorage 配置会触发自动 `loadKnowledgeBases`，该 in-flight 旧列表响应可能在创建知识库后返回并覆盖新建状态。已在 `frontend/src/App.tsx` 为知识库列表加载加入请求序号 `knowledgeLoadRequestId`，创建成功后递增序号使旧列表响应失效，并在状态合并时去重保留新建知识库；同时 `frontend/e2e/console.spec.ts` 开场清空 localStorage 并 reload，确保验收从干净控制台开始。复验：`cd frontend && bun run lint` 通过；`cd frontend && bun run build` 通过；`cd frontend && bun run test` 通过；`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 通过；`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次通过。

第 2 轮质量检查修复：反馈再次指出 e2e 在创建知识库后偶发找不到新建按钮。进一步加固 `frontend/playwright.config.ts`，将三个 webServer 的 `reuseExistingServer` 改为 `false`，并新增 `frontend/scripts/stop-e2e-ports.ts`，让 `bun run test:e2e` 每次先释放 4011/9898/5174 端口，避免复用旧前端/旧后端进程。`frontend/e2e/console.spec.ts` 也改为等待 `POST /api/admin/knowledge-bases` 返回并断言 status 201，再检查 UI，失败时能定位真实接口问题。复验：`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次通过；`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test`、`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 均通过。

第 3 轮质量检查修复：反馈指出 e2e 偶发卡在等待 `POST /api/admin/knowledge-bases`。进一步降低测试对瞬时 response 事件的脆弱依赖：`frontend/e2e/console.spec.ts` 将 `uniqueName` 移入 test 内并加入 retry 序号，使用 `page.addInitScript(() => localStorage.clear())` 在应用脚本运行前清空本地状态，先用 `request.get('http://127.0.0.1:9898/')` 确认真实后端可达，再点击创建并以用户可见的 `知识库创建成功` 和新知识库按钮作为主要断言；`frontend/playwright.config.ts` 增加 `retries: 1` 应对真实服务/浏览器启动抖动。复验：`cd frontend && for i in 1 2 3 4 5; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 5 次通过；`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test`、`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 均通过。

第 4 轮质量检查修复：反馈指出 e2e 服务启动链路仍偶发 `ECONNREFUSED`，并且失败产物可能缺失。已将 e2e 服务生命周期从 Playwright `webServer` 改为自管 runner：新增 `frontend/scripts/run-e2e.ts`，由它清理 4011/9898/5174 端口、显式启动本地 OpenAI-compatible provider、真实后端和 Vite 前端、逐个健康检查通过后再执行 `playwright test`，结束时只清理自己启动的进程；`frontend/playwright.config.ts` 只保留测试配置，不再管理 webServer。`frontend/package.json` 的 `test:e2e` 改为 `bun scripts/run-e2e.ts`。复验：`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 通过；`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次通过；`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test`、`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 均通过。

第 5 轮质量检查修复：反馈指出 `test:e2e` 首轮失败但 retry 通过，不能作为稳定证据。已将 `frontend/playwright.config.ts` 的 `retries` 改为 `0`；`frontend/scripts/run-e2e.ts` 的服务就绪判定改为连续 3 次健康检查成功；`frontend/e2e/console.spec.ts` 移除测试内额外的后端探测，后端可用性统一由 runner 负责。复验：`cd frontend && for i in 1 2 3 4 5; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 无 retry 连续 5 次通过。

第 6 轮质量检查修复：反馈指出创建知识库后 e2e 用名称查找按钮出现 strict mode violation。已在 `frontend/src/App.tsx` 中为知识库列表状态统一按 `id` 去重，并给每个知识库按钮增加包含服务端 id 的唯一 `aria-label`；`frontend/e2e/console.spec.ts` 创建知识库时读取真实 POST 响应中的 `data.id`，再按 `Knowledge base <name> #<id>` 验证唯一新建项，避免历史同名数据或允许同名知识库导致断言冲突。`frontend/scripts/run-e2e.ts` 也改为保存 Playwright exit code，等待测试进程结束并清理服务后再统一退出，避免失败产物写入与退出清理时序互相踩踏。复验：`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 首轮通过；`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次首轮通过；`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test`、`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 均通过。

第 7 轮质量检查修复：反馈指出保存配置后前置同步不够稳定，以及上传文档后 Bot 配置区域可能被全量刷新链路影响。已修复 `frontend/src/App.tsx` 中 `loadKnowledgeBases` 对 `selectedKnowledgeBaseId` 的闭包依赖：用 `selectedKnowledgeBaseIdRef` 读取当前选中项，避免 `loadKnowledgeBases -> setSelectedKnowledgeBaseId -> useEffect` 形成重复全量刷新；选择知识库时同步更新 ref。`handleSaveWidget` 保存后只局部刷新知识库列表计数，不再调用会重载文档和 Widget 表单详情的 `loadKnowledgeBases()`，减少用户正在配置 Bot 时的 DOM 替换和 disabled 抖动。`frontend/e2e/console.spec.ts` 在保存配置后等待“名称”输入框和“创建知识库”按钮 enabled，在提交 Bot 前等待 Header 输入框和“创建 Bot 配置”按钮 enabled。复验：`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 首轮通过；`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次首轮通过；`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test`、`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 均通过。

第 8 轮质量检查修复：反馈指出固定端口 e2e runner 仍可能遇到 `EADDRINUSE`，并可能把旧服务误判为当前服务 ready；同时 e2e 的 `page.waitForResponse` 仍会在前置状态异常时悬空超时。已重写 `frontend/scripts/run-e2e.ts`：使用 Node `net` 为 mock provider、真实后端和 Vite 前端分配唯一动态端口，通过环境变量将 `E2E_API_BASE_URL` 和 `E2E_FRONTEND_URL` 注入 Playwright；启动后监控子进程退出，任一服务 ready 前退出会立即失败；Vite 使用 `--strictPort`；Playwright 只连接本 runner 注入的端口，不再依赖 4011/9898/5174 固定端口或清理旧端口。`frontend/playwright.config.ts` 改为读取 `E2E_FRONTEND_URL`；`frontend/e2e/console.spec.ts` 改为读取 `E2E_API_BASE_URL`，并移除创建知识库阶段的 `waitForResponse`，以用户可见的成功提示和唯一 `aria-label` 为主断言。复验：`cd frontend && bun run lint`、`cd frontend && bun run build`、`cd frontend && bun run test` 均通过；`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 动态端口首轮通过；`cd frontend && for i in 1 2 3; do LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e || exit 1; done` 连续 3 次动态端口首轮通过；`bun test src/services/rag.service.list.test.ts src/services/widget.service.test.ts src/routes/rag.route.test.ts` 12 pass。

