# 建立知识库、机器人和会话的后端基础

## Objective

完成后，系统会有清晰的知识库、机器人配置和聊天会话数据基础，后续上传文档、测试问答和外站接入都能围绕同一套后端模型工作。

## Scope

- 在现有 Bun + Hono + Prisma 后端中补齐 MVP 所需的数据模型与管理 API。
- 覆盖 KnowledgeBase、Widget/Bot、ChatSession、ChatMessage，以及文档归属知识库的关系。
- 为管理接口增加简单后台口令/API Key 保护。
- 不实现完整用户登录、组织多租户、计费、复杂权限或统计后台。

## Steps

- [x] **确认开发分支**：按仓库约定确认当前基于 `feat/rag` 开发；如需要改代码，先创建合规的 `feat/<short-name>` 本地分支，未经用户同意不推送。
- [x] **梳理现有接口**：阅读 `src/routes/rag.route.ts`、`src/services/rag.service.ts`、`prisma/schema.prisma`，确认现有文档、分片、问答接口的复用点。
- [x] **设计数据模型**：在 Prisma schema 中增加 KnowledgeBase、Widget/Bot、ChatSession、ChatMessage，并把 KnowledgeDocument 关联到 KnowledgeBase。
- [x] **生成数据库变更**：使用项目既有 Prisma 流程生成/同步开发数据库变更，确保 pgvector 字段和新增关系可正常生成 client。
- [x] **保护管理接口**：增加简单后台口令/API Key 中间件，保护知识库、文档管理、Widget 配置等管理接口，避免影响公开聊天接口。
- [x] **实现知识库 API**：提供知识库列表、创建、详情等最小管理接口，返回统一 `ApiResponse` 格式。
- [x] **实现 Widget API**：提供 Widget/Bot 配置创建、更新、读取接口，公开读取接口按 `widgetId` 返回标题、bot name、avatar、knowledgeBaseId 等安全字段。
- [x] **实现会话基础**：提供创建/获取聊天会话和保存消息的服务能力，为后续流式问答持久化做准备。
- [x] **补齐后端测试**：为新增模型服务、管理口令校验、公开配置读取和会话记录添加 Bun 测试或扩展现有测试。
- [x] **补齐知识库隔离链路**：按验收反馈核实并补齐文档入库 `knowledgeBaseId` 写入、查询/流式查询知识库过滤及对应测试。
- [x] **补齐数据库迁移文件**：按第 2 轮验收反馈核实并提交新增知识库、Widget、会话模型及文档知识库归属的 Prisma SQL 迁移。
- [x] **修复跨知识库文档哈希唯一约束**：按质量检查反馈核实并修复 `content_hash` 全局唯一与按知识库去重逻辑冲突，补充迁移与测试。

## Success Criteria

- 数据库模型能表达知识库、文档、分片、Widget/Bot、会话和消息之间的关系。
- 管理接口需要后台口令/API Key 才能访问，公开 Widget 配置读取不需要后台口令。
- 现有 RAG 问答能力没有被破坏，并能逐步迁移到按知识库隔离。
- 新增后端能力使用现有响应、错误和 logger 风格，不引入额外日志方案。

## Verification

- [x] `bun run db:generate` exit 0。
- [x] `bun test` exit 0。
- [x] 使用缺失或错误后台口令请求管理接口，响应为明确的 401/403 类错误。
- [x] 使用有效后台口令创建知识库和 Widget，响应包含可供后续 Goal 使用的 `knowledgeBaseId` 与 `widgetId`。
- [x] 不带后台口令读取公开 Widget 配置，响应只包含聊天窗口需要的安全字段。
- [x] 文档入库可写入 `knowledgeBaseId`，普通/流式查询可按 `knowledgeBaseId` 过滤。
- [x] `bun run db:migrate:dev` exit 0，且新增迁移可在干净数据库上应用。
- [x] 两个不同知识库可写入相同 `content_hash` 文档，同一知识库相同 `content_hash` 仍会被唯一约束阻止。

## Notes

- 遵守仓库 `AGENTS.md`：开发基于 `feat/rag`，修改前创建本地功能分支，不直接推送或合并。
- 如果新增环境变量，例如 `ADMIN_API_KEY`，应同步考虑 `.env.example` 是否需要在执行 Goal 中更新。
- 继续优先使用 `src/utils/logger.ts` 中已有 logger。

## Handoff

- 已确认 `src/routes/rag.route.ts` 当前提供文档入库、纯文本入库、普通/流式查询；`src/services/rag.service.ts` 可复用文档创建、分片、embedding 和检索逻辑；`prisma/schema.prisma` 现有 `KnowledgeDocument`/`KnowledgeChunk` 需要补充知识库归属与会话/Widget 模型。
- 已在 Prisma schema 设计 `KnowledgeBase`、`Widget`、`ChatSession`、`ChatMessage` 与 `ChatMessageRole`，并为 `KnowledgeDocument` 增加可空 `knowledgeBaseId` 关联，以兼容既有全局文档数据。
- 已执行 `bun run db:generate` 与 `bun run db:push`，Prisma Client 生成成功且本地 PostgreSQL `agent-rag` 已同步 schema。
- 已新增 `requireAdminApiKey` 中间件，支持 `x-admin-api-key` 与 `Authorization: Bearer`，并保护现有文档入库接口；`.env.example` 已补充 `ADMIN_API_KEY`。
- 已新增 `/api/admin/knowledge-bases` 列表/创建与 `/api/admin/knowledge-bases/:id` 详情接口，统一使用 `ApiResponse`。
- 已新增后台 `/api/admin/widgets` 创建、`/api/admin/widgets/:widgetId` 读取/更新，以及公开 `/api/widgets/:widgetId/config` 安全配置读取接口。
- 已新增 `ChatSessionService` 与公开 `/api/chat/sessions` 创建/读取、`/api/chat/sessions/:sessionId/messages` 消息保存接口，为后续问答持久化提供基础。
- 已补充管理口令、知识库服务、Widget 服务、会话服务与知识库隔离测试；`bun test` 当前 31 个测试全部通过。
- 验证创建得到 `knowledgeBaseId=1`、`widgetId=cmr8zs62h000075mah2lxwuct`，可供后续 Goal 本地联调用。
- 公开 Widget 配置已验证无需后台口令可读取，返回字段仅包含 `id`、`knowledgeBaseId`、`title`、`botName`、`botAvatar`、`welcomeMessage`，未暴露 `systemPrompt`/`isEnabled`。
- 验收反馈属实：原实现只在 schema 上建了 `KnowledgeDocument.knowledgeBaseId`，未接入文档入库和检索链路。已补齐 `RagService.createDocument` 的 `knowledgeBaseId` 校验/写入、`query`/`queryStream` 的知识库过滤，以及路由 schema 的 `knowledgeBaseId` 入参；新增测试覆盖写入与普通/流式检索过滤。
- 修复后已重新执行 `bun run db:generate && bun run db:push && bun test`，全部通过（31 pass）。
- 第 2 轮验收反馈属实：仓库缺少本 Goal 新增模型对应迁移。已新增 `20260706000000_add_knowledge_base_widget_chat_foundation`，覆盖 `knowledge_bases`、`widgets`、`chat_sessions`、`chat_messages`、`knowledge_documents.knowledge_base_id`、索引和外键；同时补齐 `migration_lock.toml`。
- 为让项目迁移历史与完整 schema 可验证，补充 `20260706010000_add_user_tables_baseline`（既有 User 模型此前也无迁移）与 `20260706092206_align_rag_migration_history`（对齐旧 RAG 迁移与当前 schema 的 FK/index 差异）。已执行 `bun run db:migrate:dev && bun run db:generate && bun test`，全部通过（31 pass）；并在临时干净数据库 `agent_rag_migration_verify_1783329741556` 上执行 `prisma migrate deploy` 成功应用全部 5 个迁移，随后已删除临时数据库。
- 质量检查反馈属实：`RagService` 已按 `contentHash + knowledgeBaseId` 判重，但 `schema.prisma` 与旧迁移仍是 `content_hash` 全局唯一。已将 Prisma schema 改为 `@@unique([knowledgeBaseId, contentHash], map: "knowledge_document_kb_hash_unique")`，新增迁移 `20260706093000_scope_document_hash_to_knowledge_base` 删除全局唯一索引并创建知识库范围复合唯一索引。无知识库的历史/全局文档仍由服务层 `knowledgeBaseId: null` 的查重逻辑处理。
- 已补充测试覆盖“相同内容可分别进入两个不同知识库”和“同一知识库相同内容命中去重”；重新执行 `bun run db:migrate:dev && bun run db:generate && bun test` 通过（33 pass）。已用 PrismaClient 实际验证两个知识库可插入相同 `contentHash`、同一知识库重复 `contentHash` 被阻止，并清理验证数据；另在临时干净数据库 `agent_rag_hash_migration_verify_1783330530845` 执行 `prisma migrate deploy` 成功应用全部 6 个迁移，随后已删除临时数据库。

