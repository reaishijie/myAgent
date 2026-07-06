import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ApiResponse } from '../core/response'
import { RagService } from '../services/rag.service'

const documentTitleSchema = z.string().trim().min(1, '标题不能为空').max(120, '标题太长啦')

const createDocumentSchema = z.object({
  title: documentTitleSchema,
  content: z.string().trim().min(1, '文档内容不能为空'),
})

const createPlainDocumentQuerySchema = z.object({
  title: documentTitleSchema,
})

const parseTopK = () => {
  const value = process.env.RAG_TOP_K
  const parsed = value ? Number(value) : 5

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 5
}

const querySchema = z.object({
  question: z.string().trim().min(1, '问题不能为空'),
  topK: z.number().int().min(1).max(10).default(parseTopK()),
})

const ragApp = new Hono()

ragApp.post('/documents', zValidator('json', createDocumentSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.createDocument(data)

  return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
})

ragApp.post('/documents/plain', zValidator('query', createPlainDocumentQuerySchema), async (c) => {
  const { title } = c.req.valid('query')
  const content = await c.req.text()
  const data = createDocumentSchema.parse({ title, content })
  const result = await RagService.createDocument(data)

  return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
})

ragApp.post('/query', zValidator('json', querySchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.query(data)

  return c.json(ApiResponse.success(result))
})

ragApp.post('/query/stream', zValidator('json', querySchema), async (c) => {
  const data = c.req.valid('json')
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of RagService.queryStream(data)) {
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

export default ragApp
