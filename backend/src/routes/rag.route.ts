import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { BadRequestException } from '../core/exceptions'
import { ApiResponse } from '../core/response'
import { assertAdminApiKey, requireAdminApiKey } from '../middleware/adminAuth.middleware'
import { RagService } from '../services/rag.service'

const documentTitleSchema = z.string().trim().min(1, '标题不能为空').max(120, '标题太长啦')

const knowledgeBaseIdSchema = z.coerce.number().int().positive()
const categorySchema = z.string().trim().min(1).max(80).optional()

const createDocumentSchema = z.object({
  title: documentTitleSchema,
  content: z.string().trim().min(1, '文档内容不能为空'),
  knowledgeBaseId: knowledgeBaseIdSchema.optional(),
  category: categorySchema,
})

const createPlainDocumentQuerySchema = z.object({
  title: documentTitleSchema,
  knowledgeBaseId: knowledgeBaseIdSchema.optional(),
  category: categorySchema,
})

const listDocumentsQuerySchema = z.object({
  knowledgeBaseId: knowledgeBaseIdSchema.optional(),
  category: categorySchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
})

const uploadDocumentFieldsSchema = z.object({
  title: documentTitleSchema.optional(),
  knowledgeBaseId: knowledgeBaseIdSchema.optional(),
  category: categorySchema,
})

const readMultipartField = (value: unknown) => Array.isArray(value) ? value[0] : value

const parseTopK = () => {
  const value = process.env.RAG_TOP_K
  const parsed = value ? Number(value) : 5

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 5
}

const querySchema = z.object({
  question: z.string().trim().min(1, '问题不能为空'),
  topK: z.number().int().min(1).max(10).default(parseTopK()),
  knowledgeBaseId: knowledgeBaseIdSchema.optional(),
  widgetId: z.string().trim().min(1).max(32).optional(),
  category: categorySchema,
})

type RagServiceLike = typeof RagService

export const createRagApp = (ragService: RagServiceLike = RagService) => {
  const ragApp = new Hono()
  const assertQueryAccess = (data: z.infer<typeof querySchema>, headers: Headers) => {
    if (!data.widgetId) {
      assertAdminApiKey(headers)
    }
  }

  ragApp.get('/documents', requireAdminApiKey(), zValidator('query', listDocumentsQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const result = await ragService.listDocuments(query)

    return c.json(ApiResponse.success(result))
  })

  ragApp.post('/documents', requireAdminApiKey(), zValidator('json', createDocumentSchema), async (c) => {
    const data = c.req.valid('json')
    const result = await ragService.createDocument(data)

    return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
  })

  ragApp.post('/documents/plain', requireAdminApiKey(), zValidator('query', createPlainDocumentQuerySchema), async (c) => {
    const { title, knowledgeBaseId, category } = c.req.valid('query')
    const content = await c.req.text()
    const data = createDocumentSchema.parse({ title, content, knowledgeBaseId, category })
    const result = await ragService.createDocument(data)

    return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
  })

  ragApp.post('/documents/upload', requireAdminApiKey(), async (c) => {
    const body = await c.req.parseBody()
    const rawFile = readMultipartField(body.file)

    if (!(rawFile instanceof File)) {
      throw new BadRequestException('请使用 multipart/form-data 上传 file 字段', 'DOCUMENT_FILE_REQUIRED')
    }

    const fields = uploadDocumentFieldsSchema.parse({
      title: readMultipartField(body.title),
      knowledgeBaseId: readMultipartField(body.knowledgeBaseId),
      category: readMultipartField(body.category),
    })

    const result = await ragService.createUploadedDocument({
      fileName: rawFile.name,
      mimeType: rawFile.type || undefined,
      fileSize: rawFile.size,
      buffer: await rawFile.arrayBuffer(),
      title: fields.title,
      knowledgeBaseId: fields.knowledgeBaseId,
      category: fields.category,
    })

    return c.json(ApiResponse.success(result, '文档上传并入库成功', 201), 201)
  })

  ragApp.post('/query', zValidator('json', querySchema), async (c) => {
    const data = c.req.valid('json')
    assertQueryAccess(data, c.req.raw.headers)
    const result = await ragService.query(data)

    return c.json(ApiResponse.success(result))
  })

  ragApp.post('/query/stream', zValidator('json', querySchema), async (c) => {
    const data = c.req.valid('json')
    assertQueryAccess(data, c.req.raw.headers)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of ragService.queryStream(data)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream failed'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'content-type': 'text/event-stream; charset=utf-8',
      },
    })
  })

  return ragApp
}

export default createRagApp()
