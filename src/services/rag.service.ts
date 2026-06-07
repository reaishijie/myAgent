import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { BadRequestException } from '../core/exceptions'
import { getDb } from '../db'
import { chunkText } from '../utils/chunkText'
import { EmbeddingService } from './embedding.service'
import { LlmService } from './llm.service'

interface CreateDocumentInput {
  title: string
  content: string
}

interface QueryInput {
  question: string
  topK: number
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
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value ? Number(value) : fallback
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const vectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

const hashContent = (content: string) => createHash('sha256').update(content).digest('hex')

const buildPrompt = (question: string, chunks: RetrievedChunk[]) => {
  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n')

  return `You are a question-answering assistant. Answer using only the provided context. If the context does not contain the answer, say that the knowledge base does not contain relevant information.\n\nContext:\n${context}\n\nQuestion: ${question}`
}

const createDefaultDependencies = (): RagDependencies => ({
  embed: EmbeddingService.embed,
  chat: LlmService.chat,
})

export const createRagService = (dependencies: Partial<RagDependencies> = {}) => {
  const base = createDefaultDependencies()
  const { db, embed = base.embed, chat = base.chat } = dependencies

  return {
    async createDocument(input: CreateDocumentInput) {
      const resolvedDb = db ?? getDb()
      const title = input.title.trim()
      const content = input.content.trim()

      if (!content) {
        throw new BadRequestException('文档内容不能为空', 'RAG_DOCUMENT_EMPTY')
      }

      const contentHash = hashContent(content)
      const existingDocument = await resolvedDb.knowledgeDocument.findUnique({
        where: { contentHash },
        select: { id: true, title: true },
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

      const { embeddings, model } = await embed(chunks)
      const document = await resolvedDb.knowledgeDocument.create({ data: { title, content, contentHash } })

      for (const [index, chunk] of chunks.entries()) {
        await resolvedDb.$executeRaw`
          INSERT INTO knowledge_chunks (document_id, chunk_index, content, embedding, embedding_model, token_count)
          VALUES (${document.id}, ${index}, ${chunk}, ${vectorLiteral(embeddings[index])}::vector, ${model}, ${chunk.length})
        `
      }

      return {
        id: document.id,
        title: document.title,
        chunkCount: chunks.length,
        embeddingModel: model,
        duplicated: false,
      }
    },

    async query(input: QueryInput) {
      const resolvedDb = db ?? getDb()
      const question = input.question.trim()

      if (!question) {
        throw new BadRequestException('问题不能为空', 'RAG_QUESTION_EMPTY')
      }

      const { embeddings } = await embed(question)
      const queryVector = vectorLiteral(embeddings[0])

      const chunks = await resolvedDb.$queryRaw<RetrievedChunk[]>(Prisma.sql`
        SELECT
          c.document_id AS "documentId",
          d.title AS "title",
          c.chunk_index AS "chunkIndex",
          c.content AS "content"
        FROM knowledge_chunks c
        JOIN knowledge_documents d ON d.id = c.document_id
        ORDER BY c.embedding <=> ${queryVector}::vector
        LIMIT ${input.topK}
      `)

      if (chunks.length === 0) {
        return {
          answer: '知识库中没有找到相关内容。',
          sources: [],
        }
      }

      const answer = await chat(buildPrompt(question, chunks))

      return { answer, sources: chunks }
    },
  }
}

export const RagService = createRagService()
