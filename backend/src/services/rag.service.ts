import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { BadRequestException, NotFoundException } from '../core/exceptions'
import { getDb } from '../db'
import { chunkText } from '../utils/chunkText'
import { DocumentParserService } from './documentParser.service'
import { EmbeddingService } from './embedding.service'
import { LlmService } from './llm.service'

interface CreateDocumentInput {
  title: string
  content: string
  knowledgeBaseId?: number
  category?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  fileHash?: string
  parseMetadata?: Record<string, unknown>
}

interface CreateUploadedDocumentInput {
  fileName: string
  mimeType?: string
  fileSize: number
  buffer: ArrayBuffer | Uint8Array
  title?: string
  knowledgeBaseId?: number
  category?: string
}

interface QueryInput {
  question: string
  topK: number
  knowledgeBaseId?: number
  widgetId?: string
  category?: string
}

interface ListDocumentsInput {
  knowledgeBaseId?: number
  category?: string
  page?: number
  pageSize?: number
}

interface RetrievedChunk {
  documentId: number
  title: string
  chunkIndex: number
  content: string
}

interface RagDependencies {
  db?: ReturnType<typeof getDb>
  embed: typeof EmbeddingService.embed
  chat: typeof LlmService.chat
  streamChat: typeof LlmService.streamChat
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value ? Number(value) : fallback
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const vectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

const hashContent = (content: string) => createHash('sha256').update(content).digest('hex')

const hashBytes = (bytes: ArrayBuffer | Uint8Array) => createHash('sha256').update(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).digest('hex')

const normalizeCategory = (category: string | undefined) => category?.trim() || null

const buildDocumentMetadata = (input: CreateDocumentInput) => {
  const metadata: Record<string, unknown> = {
    ...(input.parseMetadata ?? {}),
  }

  if (input.fileName) {
    metadata.fileName = input.fileName
  }
  if (input.mimeType) {
    metadata.mimeType = input.mimeType
  }
  if (input.fileSize !== undefined) {
    metadata.fileSize = input.fileSize
  }
  if (input.fileHash) {
    metadata.fileHash = input.fileHash
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

const ensureKnowledgeBaseExists = async (db: ReturnType<typeof getDb>, knowledgeBaseId: number) => {
  const knowledgeBase = await db.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { id: true },
  })

  if (!knowledgeBase) {
    throw new NotFoundException('知识库不存在', 'KNOWLEDGE_BASE_NOT_FOUND')
  }
}

const resolveQueryKnowledgeBaseId = async (db: ReturnType<typeof getDb>, input: QueryInput) => {
  if (input.knowledgeBaseId) {
    await ensureKnowledgeBaseExists(db, input.knowledgeBaseId)
    return input.knowledgeBaseId
  }

  if (!input.widgetId) {
    return undefined
  }

  const widget = await db.widget.findFirst({
    where: { id: input.widgetId, isEnabled: true },
    select: { knowledgeBaseId: true },
  })

  if (!widget) {
    throw new NotFoundException('Widget 不存在或已停用', 'WIDGET_NOT_FOUND')
  }

  return widget.knowledgeBaseId
}

const retrieveHybridChunks = async (db: ReturnType<typeof getDb>, question: string, queryVector: string, topK: number, knowledgeBaseId?: number, category?: string | null) => {
  const candidateLimit = Math.max(topK * 4, 20)
  const filters: Prisma.Sql[] = []
  if (knowledgeBaseId) {
    filters.push(Prisma.sql`d.knowledge_base_id = ${knowledgeBaseId}`)
  }
  if (category) {
    filters.push(Prisma.sql`d.category = ${category}`)
  }

  const documentFilter = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
    : Prisma.empty
  const keywordConditions = [
    ...filters,
    Prisma.sql`(to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${question}) OR lower(c.content) LIKE '%' || lower(${question}) || '%')`,
  ]
  const keywordFilter = Prisma.sql`WHERE ${Prisma.join(keywordConditions, ' AND ')}`

  return db.$queryRaw<RetrievedChunk[]>(Prisma.sql`
    WITH vector_matches AS (
      SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title,
        c.chunk_index,
        c.content,
        row_number() OVER (ORDER BY c.embedding <=> ${queryVector}::vector) AS vector_rank,
        NULL::bigint AS keyword_rank
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c.document_id
      ${documentFilter}
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${candidateLimit}
    ),
    keyword_matches AS (
      SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title,
        c.chunk_index,
        c.content,
        NULL::bigint AS vector_rank,
        row_number() OVER (
          ORDER BY
            ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${question})) DESC,
            CASE WHEN lower(c.content) LIKE '%' || lower(${question}) || '%' THEN 1 ELSE 0 END DESC,
            c.id ASC
        ) AS keyword_rank
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c.document_id
      ${keywordFilter}
      LIMIT ${candidateLimit}
    ),
    fused AS (
      SELECT
        chunk_id,
        document_id,
        title,
        chunk_index,
        content,
        MIN(vector_rank) AS vector_rank,
        MIN(keyword_rank) AS keyword_rank
      FROM (
        SELECT * FROM vector_matches
        UNION ALL
        SELECT * FROM keyword_matches
      ) matches
      GROUP BY chunk_id, document_id, title, chunk_index, content
    )
    SELECT
      document_id AS "documentId",
      title AS "title",
      chunk_index AS "chunkIndex",
      content AS "content"
    FROM fused
    ORDER BY
      (COALESCE(1.0 / (60 + vector_rank), 0) * 0.7 + COALESCE(1.0 / (60 + keyword_rank), 0) * 0.3) DESC,
      COALESCE(vector_rank, keyword_rank) ASC
    LIMIT ${topK}
  `)
}

const buildPrompt = (question: string, chunks: RetrievedChunk[]) => {
  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n')

  return `你是一个问答助手。请基于 Context 直接回答用户问题。\n回答风格要求：\n- 开门见山，直接给出答案。\n- 不要使用“根据提供的上下文”“根据上下文”“从上下文来看”“资料显示”等开场白。\n- 如果适合用列表说明，可以使用 Markdown 列表。\n- 如果 Context 没有直接答案，但可以结合 Context、中文常识或常见语言习惯进行合理推断，请回答推断结果，并明确说明这是推断。\n- 如果无法合理推断，再说明知识库中没有相关内容。\n\nContext:\n${context}\n\nQuestion: ${question}`
}

const createDefaultDependencies = (): RagDependencies => ({
  embed: EmbeddingService.embed,
  chat: LlmService.chat,
  streamChat: LlmService.streamChat,
})

export const createRagService = (dependencies: Partial<RagDependencies> = {}) => {
  const base = createDefaultDependencies()
  const { db, embed = base.embed, chat = base.chat, streamChat = base.streamChat } = dependencies

  return {
    async listDocuments(input: ListDocumentsInput = {}) {
      const resolvedDb = db ?? getDb()

      if (input.knowledgeBaseId) {
        await ensureKnowledgeBaseExists(resolvedDb, input.knowledgeBaseId)
      }

      const category = normalizeCategory(input.category)
      const page = input.page && input.page > 0 ? input.page : 1
      const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 10
      const where = {
        ...(input.knowledgeBaseId ? { knowledgeBaseId: input.knowledgeBaseId } : {}),
        ...(category ? { category } : {}),
      }

      const [total, documents, categories] = await Promise.all([
        resolvedDb.knowledgeDocument.count({ where }),
        resolvedDb.knowledgeDocument.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            knowledgeBaseId: true,
            category: true,
            title: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            parseStatus: true,
            parseError: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { chunks: true },
            },
          },
        }),
        resolvedDb.knowledgeDocument.findMany({
          where: input.knowledgeBaseId ? { knowledgeBaseId: input.knowledgeBaseId, category: { not: null } } : { category: { not: null } },
          distinct: ['category'],
          orderBy: { category: 'asc' },
          select: { category: true },
        }),
      ])

      return {
        items: documents.map((document: any) => ({
          id: document.id,
          knowledgeBaseId: document.knowledgeBaseId,
          category: document.category,
          title: document.title,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          parseStatus: document.parseStatus,
          parseError: document.parseError,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          chunkCount: document._count?.chunks ?? 0,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
        categories: categories.map((item: any) => item.category).filter(Boolean),
      }
    },

    async createUploadedDocument(input: CreateUploadedDocumentInput) {
      const fileHash = hashBytes(input.buffer)
      const parsed = await DocumentParserService.parse({
        fileName: input.fileName,
        mimeType: input.mimeType,
        buffer: input.buffer,
      })
      const title = input.title?.trim() || input.fileName

      return this.createDocument({
        title,
        content: parsed.text,
        knowledgeBaseId: input.knowledgeBaseId,
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        fileHash,
        parseMetadata: parsed.metadata,
      })
    },

    async createDocument(input: CreateDocumentInput) {
      const resolvedDb = db ?? getDb()
      const title = input.title.trim()
      const content = input.content.trim()
      const knowledgeBaseId = input.knowledgeBaseId
      const category = normalizeCategory(input.category)

      if (!content) {
        throw new BadRequestException('文档内容不能为空', 'RAG_DOCUMENT_EMPTY')
      }

      if (knowledgeBaseId) {
        await ensureKnowledgeBaseExists(resolvedDb, knowledgeBaseId)
      }

      const contentHash = hashContent(content)
      const documentMetadata = buildDocumentMetadata(input)
      const existingDocument = await resolvedDb.knowledgeDocument.findFirst({
        where: { contentHash, knowledgeBaseId: knowledgeBaseId ?? null },
        select: { id: true, title: true, knowledgeBaseId: true, category: true },
      })

      if (existingDocument) {
        const [chunkCount, firstChunk] = await Promise.all([
          resolvedDb.knowledgeChunk.count({ where: { documentId: existingDocument.id } }),
          resolvedDb.knowledgeChunk.findFirst({
            where: { documentId: existingDocument.id },
            orderBy: { chunkIndex: 'asc' },
            select: { embeddingModel: true },
          }),
        ])

        return {
          id: existingDocument.id,
          title: existingDocument.title,
          knowledgeBaseId: existingDocument.knowledgeBaseId,
          category: existingDocument.category,
          chunkCount,
          embeddingModel: firstChunk?.embeddingModel ?? null,
          duplicated: true,
        }
      }

      const chunkSize = parsePositiveInt(process.env.RAG_CHUNK_SIZE, 800)
      const overlap = parsePositiveInt(process.env.RAG_CHUNK_OVERLAP, 120)
      const chunks = chunkText(content, { chunkSize, overlap })

      if (chunks.length === 0) {
        throw new BadRequestException('文档内容不能为空', 'RAG_DOCUMENT_EMPTY')
      }

      const { embeddings, model, usage } = await embed(chunks)
      const document = await resolvedDb.knowledgeDocument.create({
        data: {
          title,
          content,
          contentHash,
          knowledgeBaseId: knowledgeBaseId ?? null,
          category,
          ...(input.fileName ? { fileName: input.fileName } : {}),
          ...(input.mimeType ? { mimeType: input.mimeType } : {}),
          ...(input.fileSize !== undefined ? { fileSize: input.fileSize } : {}),
          ...(input.fileHash ? { fileHash: input.fileHash } : {}),
          ...(documentMetadata ? { metadata: documentMetadata } : {}),
          parseStatus: 'COMPLETED',
          parseError: null,
        },
      })

      for (const [index, chunk] of chunks.entries()) {
        await resolvedDb.$executeRaw`
          INSERT INTO knowledge_chunks (document_id, chunk_index, content, embedding, embedding_model, token_count)
          VALUES (${document.id}, ${index}, ${chunk}, ${vectorLiteral(embeddings[index])}::vector, ${model}, ${chunk.length})
        `
      }

      return {
        id: document.id,
        title: document.title,
        knowledgeBaseId: document.knowledgeBaseId,
        category: document.category,
        chunkCount: chunks.length,
        embeddingModel: model,
        duplicated: false,
        usage: usage ? { embedding: usage } : undefined,
      }
    },

    async query(input: QueryInput) {
      const resolvedDb = db ?? getDb()
      const question = input.question.trim()

      if (!question) {
        throw new BadRequestException('问题不能为空', 'RAG_QUESTION_EMPTY')
      }

      const knowledgeBaseId = await resolveQueryKnowledgeBaseId(resolvedDb, input)
      const { embeddings, usage: embeddingUsage } = await embed(question)
      const queryVector = vectorLiteral(embeddings[0])
      const chunks = await retrieveHybridChunks(resolvedDb, question, queryVector, input.topK, knowledgeBaseId, normalizeCategory(input.category))

      if (chunks.length === 0) {
        return {
          answer: '知识库中没有找到相关内容。',
          sources: [],
          usage: embeddingUsage ? { embedding: embeddingUsage } : undefined,
        }
      }

      const { answer, usage: chatUsage } = await chat(buildPrompt(question, chunks))

      return {
        answer,
        sources: chunks,
        usage: {
          ...(embeddingUsage ? { embedding: embeddingUsage } : {}),
          ...(chatUsage ? { chat: chatUsage } : {}),
        },
      }
    },

    async *queryStream(input: QueryInput) {
      const resolvedDb = db ?? getDb()
      const question = input.question.trim()

      if (!question) {
        throw new BadRequestException('问题不能为空', 'RAG_QUESTION_EMPTY')
      }

      const knowledgeBaseId = await resolveQueryKnowledgeBaseId(resolvedDb, input)
      const { embeddings } = await embed(question)
      const queryVector = vectorLiteral(embeddings[0])
      const chunks = await retrieveHybridChunks(resolvedDb, question, queryVector, input.topK, knowledgeBaseId, normalizeCategory(input.category))

      yield { type: 'sources' as const, sources: chunks }

      if (chunks.length === 0) {
        yield { type: 'delta' as const, content: '知识库中没有找到相关内容。' }
        yield { type: 'done' as const }
        return
      }

      for await (const content of streamChat(buildPrompt(question, chunks))) {
        yield { type: 'delta' as const, content }
      }

      yield { type: 'done' as const }
    },
  }
}

export const RagService = createRagService()
