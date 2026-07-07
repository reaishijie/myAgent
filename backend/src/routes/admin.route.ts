import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ApiResponse } from '../core/response'
import { requireAdminApiKey } from '../middleware/adminAuth.middleware'
import { KnowledgeBaseService } from '../services/knowledgeBase.service'
import { WidgetService } from '../services/widget.service'

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const createKnowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, '知识库名称不能为空').max(80, '知识库名称太长啦'),
  description: z.string().trim().max(1000, '知识库描述太长啦').optional(),
})

const widgetIdParamSchema = z.object({
  widgetId: z.string().trim().min(1),
})

const createWidgetSchema = z.object({
  knowledgeBaseId: z.number().int().positive(),
  title: z.string().trim().min(1, 'Widget 标题不能为空').max(80, 'Widget 标题太长啦'),
  botName: z.string().trim().min(1).max(80).optional(),
  botAvatar: z.string().trim().max(255).optional().nullable(),
  welcomeMessage: z.string().trim().max(1000).optional().nullable(),
  systemPrompt: z.string().trim().max(4000).optional().nullable(),
  isEnabled: z.boolean().optional(),
})

const updateWidgetSchema = createWidgetSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提供一个更新字段',
})

const adminApp = new Hono()

adminApp.use('*', requireAdminApiKey())

adminApp.get('/knowledge-bases', async (c) => {
  const result = await KnowledgeBaseService.list()

  return c.json(ApiResponse.success(result))
})

adminApp.post('/knowledge-bases', zValidator('json', createKnowledgeBaseSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await KnowledgeBaseService.create(data)

  return c.json(ApiResponse.success(result, '知识库创建成功', 201), 201)
})

adminApp.get('/knowledge-bases/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const result = await KnowledgeBaseService.get(id)

  return c.json(ApiResponse.success(result))
})

adminApp.get('/knowledge-bases/:id/widgets', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const result = await WidgetService.listByKnowledgeBase(id)

  return c.json(ApiResponse.success(result))
})

adminApp.post('/widgets', zValidator('json', createWidgetSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await WidgetService.create(data)

  return c.json(ApiResponse.success(result, 'Widget 创建成功', 201), 201)
})

adminApp.get('/widgets/:widgetId', zValidator('param', widgetIdParamSchema), async (c) => {
  const { widgetId } = c.req.valid('param')
  const result = await WidgetService.get(widgetId)

  return c.json(ApiResponse.success(result))
})

adminApp.patch('/widgets/:widgetId', zValidator('param', widgetIdParamSchema), zValidator('json', updateWidgetSchema), async (c) => {
  const { widgetId } = c.req.valid('param')
  const data = c.req.valid('json')
  const result = await WidgetService.update(widgetId, data)

  return c.json(ApiResponse.success(result, 'Widget 更新成功'))
})

export default adminApp
