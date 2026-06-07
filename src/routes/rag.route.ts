import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ApiResponse } from '../core/response'
import { RagService } from '../services/rag.service'

const createDocumentSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题太长啦'),
  content: z.string().trim().min(1, '文档内容不能为空'),
})

const querySchema = z.object({
  question: z.string().trim().min(1, '问题不能为空'),
  topK: z.number().int().min(1).max(10).default(5),
})

const ragApp = new Hono()

ragApp.post('/documents', zValidator('json', createDocumentSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.createDocument(data)

  return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
})

ragApp.post('/query', zValidator('json', querySchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.query(data)

  return c.json(ApiResponse.success(result))
})

export default ragApp
