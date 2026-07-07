# 最终验收端到端智能体系统

## Objective

完成后，整个 MVP 会被统一复核：管理端能上传知识库，外站能一行代码接入聊天窗口，后端能基于知识库内容流式回答问题。

## Scope

- 复核 G1 到 G4 的所有交付物、Handoff、遗留问题和验收标准。
- 运行后端、前端、数据库生成和端到端人工验证。
- 检查文档、环境变量示例和开发约定是否需要随功能变化更新。
- 不新增大功能；只做验收收口、必要的小修复和文档补齐。

## Steps

- [x] **读所有 Handoff**：逐一阅读 G1、G2、G3、G4 的 Handoff，确认产出物、验证结果、遗留问题和 criteriaChanged 记录。
- [x] **复核数据链路**：确认 KnowledgeBase、文档、分片、Widget、ChatSession、ChatMessage 关系完整，且知识库隔离没有明显漏洞。
- [x] **复核接口权限**：确认管理接口需要后台口令/API Key，Widget 配置和聊天接口可公开跨域访问，二者边界清晰。
- [x] **全局后端验证**：运行后端依赖安装、Prisma client 生成和测试命令，确认后端基础质量达标。
- [x] **全局前端验证**：运行前端依赖安装、lint 和 build，确认控制台与 Widget 构建通过。
- [x] **端到端演练**：人工完成创建知识库、上传文档、配置 Widget、复制 script、在独立 HTML 页面聊天的完整流程。
- [x] **检查引用与时间**：确认管理端测试问答展示 sources，Widget 默认展示答案、bot 信息和每条消息时间。
- [x] **文档收口**：检查 README、`.env.example`、docs 或 AGENTS.md 是否因新增命令、环境变量、接入方式需要更新；需要则补齐。
- [x] **确认无遗留**：搜索新增代码中的 TODO/FIXME/临时调试内容，确认无未关闭阻塞问题；无法解决的非阻塞项写入 Handoff。

## Success Criteria

- 从空知识库创建到外站聊天的 MVP 主流程可完整跑通。
- 后端测试、Prisma 生成、前端构建等关键验证通过，或明确记录非业务阻塞原因。
- 文档和环境变量示例能指导开发者启动服务、配置模型、保护管理接口并接入 Widget。
- 所有先序 Goal 的 Handoff 已复核，遗留问题已关闭或清晰记录。
- 没有把多租户、计费、复杂权限、OCR 等延期能力误作为已完成能力宣传。

## Verification

- [x] `bun install` exit 0。
- [x] `bun run db:generate` exit 0。
- [x] `bun test` exit 0。
- [x] `cd frontend && bun install` exit 0。
- [x] `cd frontend && bun run lint` exit 0，或 Handoff 记录明确的既有 lint 阻塞。
- [x] `cd frontend && bun run build` exit 0。
- [x] 人工端到端验证：创建知识库、上传 txt/md/pdf/docx 中至少两种文件、测试问答看到 sources、配置 Widget、复制一行 script 到独立 HTML、完成一次流式聊天。
- [x] `grep -R "TODO\|FIXME\|console.log" src frontend/src frontend/public` 无新增未解释的临时项，或 Handoff 明确说明保留原因。

## Notes

- Final acceptance 可以做小范围收口修复，但不应引入新的产品分支或重构大模块。
- 如发现某个先序 Goal 的目标与实际实现发生变化，需要在 Handoff 中明确记录 criteriaChanged 和用户可见影响。
- 验收后不要推送远程分支，除非用户明确同意。

## Handoff

- 已完成 G1-G4 全部 Handoff 复核：G1/G2/G3/G4 交付物均已在当前分支落地；无未关闭阻塞项。已记录的能力边界/criteria deviation 只有 G2 的中文关键词检索采用 PostgreSQL `simple` + `LIKE` 的 MVP 策略，未宣传为完整中文分词/OCR 能力。
- 数据链路复核通过：`KnowledgeBase -> KnowledgeDocument -> KnowledgeChunk`、`KnowledgeBase -> Widget -> ChatSession -> ChatMessage` 关系完整；Widget 会话固定记录 `knowledgeBaseId`，聊天流使用会话知识库隔离检索；文档 hash 已按知识库范围去重。
- 接口权限复核并修复：管理接口继续要求 `ADMIN_API_KEY`；`/api/rag/query` 与 `/api/rag/query/stream` 仅在携带 `widgetId` 时公开，按 `knowledgeBaseId` 的管理调试查询现在必须带后台口令，避免外部只凭知识库 ID 查询任意知识库。前端管理端测试问答已同步发送后台口令。
- 跨域收口修复：补齐 `/api/rag/documents`、`/api/rag/documents/*`、`/api/rag/query`、`/api/rag/query/*` 实际响应 CORS 头，解决浏览器中上传文档和管理端流式问答被 CORS 拦截为 `Failed to fetch` 的问题；`src/app.widget.test.ts` 已覆盖文档上传实际响应 CORS、RAG 查询 CORS 和管理接口无口令 401。
- 前端竞态收口修复：保存 API Base URL/后台口令时使旧知识库加载请求失效，旧请求失败不再覆盖当前 UI；上传、保存 Widget、测试问答改用最新选中知识库 ref，避免快速操作时使用旧选中项。e2e 中也显式确认新建知识库被选中。
- 端到端验收通过：`cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e` 通过。该测试启动 mock OpenAI provider、真实后端和 Vite 前端，完成创建知识库、上传 `md` 与 `txt` 两种文件、配置 Widget、复制 script、管理端流式问答看到 sources、独立 HTML 页面粘贴 script 后打开 iframe Widget 并完成流式聊天；同时断言 Widget 显示 bot 信息、欢迎消息和 3 条消息时间。
- 文档收口完成：根 `README.md` 已更新 MVP 能力、环境变量、后台口令、管理/公开接口、前端控制台启动和一行脚本接入；`frontend/README.md` 已从 Vite 模板替换为控制台/Widget 使用说明；`.env.example` 默认数据库名更新为 `agent-rag` 并保留模型配置与 `ADMIN_API_KEY`。
- 最终验证通过：`bun install`、`bun run db:generate`、`bun test`（50 pass）、`cd frontend && bun install`、`cd frontend && bun run lint`、`cd frontend && bun run build` 均 0 退出；额外执行 `cd frontend && bun test src/App.test.tsx` 通过（3 pass）。
- 遗留搜索：`grep -R "TODO\|FIXME\|console.log" src frontend/src frontend/public` 仅命中 `src/index.ts` 的服务启动提示和 `src/utils/logger.ts` 的项目 logger 输出，均为有意保留的运行日志；无 TODO/FIXME 或未解释的临时调试内容。
- 工作区说明：本 Goal 未提交、未推送、未合并；Playwright 临时失败产物 `frontend/test-results`/`frontend/playwright-report` 已清理。当前分支仍为 `feat/widget-chat-window`，包含前序 Goal 和本次 Final acceptance 的本地改动。
- 完成验收反馈复核补充：反馈 1 指出缺少安装命令证据，已重新实跑 `bun install; echo ROOT_BUN_INSTALL_EXIT:$?` 与 `cd frontend && bun install; echo FRONTEND_BUN_INSTALL_EXIT:$?`，输出分别为 `ROOT_BUN_INSTALL_EXIT:0`、`FRONTEND_BUN_INSTALL_EXIT:0`。反馈 2 指出 e2e 输出中曾出现 `script "dev" exited with code 143`，核实该信息来自 runner 主动清理 `bun run dev` 包装进程时的误导性噪声；已将 `frontend/scripts/run-e2e.ts` 改为直接启动 Vite CLI，重新执行 `cd frontend && LD_LIBRARY_PATH=/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu NO_PROXY=127.0.0.1,localhost bun run test:e2e; code=$?; echo E2E_EXIT:$code; exit $code`，结果 `1 passed` 且 `E2E_EXIT:0`，不再出现 143 噪声。修改后补跑 `cd frontend && bun run lint; echo FRONTEND_LINT_EXIT:$?`，输出 `FRONTEND_LINT_EXIT:0`。新产生的 Playwright 临时产物已再次清理。

