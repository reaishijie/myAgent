# 让文档上传后完成解析、入库和混合检索

## Objective

完成后，用户可以上传文本、Markdown、PDF 和 Word 文档，后端会同步解析、分片、向量化入库，并用向量加关键词的混合检索回答问题。

## Scope

- 在后端补齐 multipart 文件上传、基础文本抽取、按知识库入库、同步 embedding 和混合检索。
- 支持 txt、md、pdf、docx 的基础文本解析；不做 OCR、扫描件识别、复杂表格或版式还原。
- 上传后只保存解析文本、文件名、类型、大小、hash、解析元数据和分片，不保存原始二进制文件。
- 检索使用 PostgreSQL 内置全文检索能力与 pgvector 融合，不引入外部搜索引擎。

## Steps

- [x] **确认模型衔接**：基于 G1 的 KnowledgeBase 和文档关系，确认文档创建、去重和分片入库需要调整的字段。
- [x] **加入解析依赖**：选择适合 Bun 环境的 PDF/docx 基础文本解析库，更新依赖并验证不会破坏现有构建。
- [x] **实现文件解析**：新增文档解析服务，按 mime type/扩展名处理 txt、md、pdf、docx，并对不支持格式返回明确错误。
- [x] **实现上传接口**：新增受后台口令保护的文档上传接口，接收 knowledgeBaseId、文件和可选标题，完成同步解析与入库。
- [x] **保存文档元数据**：记录文件名、类型、大小、hash、解析状态、错误信息和必要 metadata，同时避免保存原始文件二进制。
- [x] **按知识库分片入库**：复用现有 `chunkText` 与 EmbeddingService，将分片写入所属知识库文档，保留 embedding model 和 tokenCount。
- [x] **实现全文检索字段**：为 chunk 或文档增加 PostgreSQL 全文检索所需字段/索引，确保中文内容至少能做基础关键词召回。
- [x] **实现混合检索**：在 RagService 中按 knowledgeBaseId 同时计算向量相似度和全文检索分数，使用加权或 RRF 融合排序。
- [x] **改造问答接口**：让普通和流式问答都支持 knowledgeBaseId/widgetId 上下文，返回 sources 给管理端调试。
- [x] **补齐检索测试**：为解析失败、重复上传、知识库隔离、无命中、混合检索排序和流式 sources 添加测试。

## Success Criteria

- 管理端可通过接口上传 txt、md、pdf、docx 并完成同步入库。
- 文档入库后能按所属知识库进行隔离检索，不串到其他知识库。
- 问答结果使用混合检索召回，并能返回 sources 供管理端查看。
- 不保存原始文件二进制，错误场景返回可理解的业务错误。

## Verification

- [x] `bun install` 后依赖解析正常，lockfile 与 package 配套。
- [x] `bun run db:generate` exit 0。
- [x] `bun test` exit 0。
- [x] 使用 curl 或等效请求上传 txt/md/pdf/docx 示例文件，接口均返回文档 ID、chunkCount 和 embeddingModel。
- [x] 对同一知识库提问，返回答案和 sources；对另一个空知识库提问，不返回前一个知识库的 sources。
- [x] 使用不支持的文件格式上传，接口返回明确的 4xx 错误和错误码。
- [x] 补充不 mock `createUploadedDocument` 的路由集成测试，覆盖 txt/md/pdf/docx 上传到解析、分片、embedding、db 写入链路。
- [x] 补充问答路由集成测试，覆盖上传后同知识库返回 sources、空知识库隔离、流式首个 sources 事件和 widgetId 上下文。

## Notes

- 模型衔接确认：现有 `KnowledgeBase -> KnowledgeDocument -> KnowledgeChunk` 已能承载按知识库入库；本 Goal 需要在 `KnowledgeDocument` 补充上传元数据字段（fileName/mimeType/fileSize/fileHash/parseStatus/parseError），复用按 `knowledgeBaseId + contentHash` 去重；全文检索优先通过 chunk 内容表达式索引实现，避免保存原始二进制。
- 如果 PostgreSQL 中文全文检索能力有限，MVP 可先采用 `to_tsvector('simple', content)` 或相近实现，并在 Handoff 记录后续中文分词优化建议。
- 保持现有 OpenAI-compatible embedding/chat 配置方式，不在本 Goal 引入新模型供应商抽象。
- 同步入库可能对大文件较慢，需要在前端 Goal 展示 loading；本 Goal 可预留状态字段但不实现任务队列。

## Handoff

- 已完成当前 Goal：新增 `src/services/documentParser.service.ts`，支持 txt/md/PDF/docx 基础文本抽取；新增 `/api/rag/documents/upload` multipart 上传接口，后台口令保护，上传后同步解析、分片、embedding 入库。
- Prisma schema/migrations 已补齐上传元数据字段（fileName/mimeType/fileSize/fileHash/parseStatus/parseError）和 chunk 全文检索 GIN 表达式索引；不保存原始二进制，仅保存解析文本、元数据和分片。
- RagService 已支持 `knowledgeBaseId` 隔离与 `widgetId` 解析上下文；检索改为向量候选 + PostgreSQL `to_tsvector('simple', content)`/LIKE 关键词候选的 RRF 加权融合，普通/流式问答均返回 sources。
- 已补齐解析、上传路由、去重、知识库隔离、无命中、混合检索 SQL、widget 上下文和流式 sources 测试。
- 验证通过：`bun install`、`bun run db:generate`、`bun test`（44 pass）、`bun run build:fc`。
- 验收反馈修复：`src/routes/rag.route.test.ts` 现在通过 `createRagApp(createRagService({ fake db/embed/chat }))` 做不 mock `createUploadedDocument` 的路由集成验证，覆盖 txt/md/pdf/docx 从 multipart 上传到真实解析、分片、embedding 替身、DB 写入替身的完整链路，并校验返回 document id、chunkCount、embeddingModel 与未保存二进制。
- 验收反馈修复：新增上传后问答路由集成验证，覆盖同知识库 `/query` 返回 answer+sources、空知识库不串 sources、`/query/stream` 首个 SSE 事件为 sources、`widgetId` 正确解析到知识库。
- 修复验证中暴露的问题：`pdf-parse` 可能转移并 detach 上传 Uint8Array，已将上传文件 hash 计算移动到解析前，避免 PDF 上传后 `Buffer is already detached`。
- 注意：中文全文检索 MVP 使用 PostgreSQL `simple` 配置并叠加 `LIKE` 精确子串召回；后续可接入更适合中文的分词/tsvector 生成策略以提升关键词召回质量。

