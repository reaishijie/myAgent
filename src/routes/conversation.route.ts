import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { MessageContentType, MessageRole, RecordStatus } from '@prisma/client'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { authMiddleware } from '../middleware/auth.middleware'
import { ConversationService } from '../services/conversation.service'

const idSchema = z.object({ id: z.coerce.number().int().positive() })
const messageIdSchema = z.object({
  id: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive(),
})
const skillIdSchema = z.object({
  id: z.coerce.number().int().positive(),
  conversationSkillId: z.coerce.number().int().positive(),
})
const conversationSchema = z.object({
  title: z.string().min(1).max(200),
  groupId: z.number().int().positive().optional(),
  defaultModelId: z.number().int().positive().optional(),
  metadata: z.any().optional(),
})
const moveSchema = z.object({
  groupId: z.number().int().positive().nullable(),
  restore: z.boolean().optional(),
})
const messageSchema = z.object({
  role: z.enum(MessageRole),
  contentType: z.enum(MessageContentType).default(MessageContentType.TEXT),
  content: z.any(),
  modelInvocationId: z.number().int().positive().optional(),
})
const conversationSkillSchema = z.object({
  userSkillId: z.number().int().positive(),
  config: z.any().optional(),
  sort: z.number().int().default(100),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
})

const app = new Hono<{ Variables: AppVariables }>()
app.use('*', authMiddleware())

app.get('/', async (c) => c.json(ApiResponse.success(await ConversationService.list(c.get('currentUser').id, c.req.query()))))
app.post('/', zValidator('json', conversationSchema), async (c) => {
  const record = await ConversationService.createForUser(c.get('currentUser').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record, 'created', 201), 201)
})
app.get('/:id', zValidator('param', idSchema), async (c) => {
  const record = await ConversationService.get(c.get('currentUser').id, c.req.valid('param').id)
  return c.json(ApiResponse.success(record))
})
app.patch('/:id', zValidator('param', idSchema), zValidator('json', conversationSchema.partial()), async (c) => {
  const record = await ConversationService.update(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record))
})
app.delete('/:id', zValidator('param', idSchema), async (c) => {
  await ConversationService.softDelete(c.get('currentUser').id, c.req.valid('param').id)
  return c.json(ApiResponse.ok('deleted'))
})
app.patch('/:id/archive', zValidator('param', idSchema), async (c) => {
  return c.json(ApiResponse.success(await ConversationService.archive(c.get('currentUser').id, c.req.valid('param').id)))
})
app.patch('/:id/restore', zValidator('param', idSchema), async (c) => {
  return c.json(ApiResponse.success(await ConversationService.restore(c.get('currentUser').id, c.req.valid('param').id)))
})
app.patch('/:id/move', zValidator('param', idSchema), zValidator('json', moveSchema), async (c) => {
  const data = c.req.valid('json')
  const record = await ConversationService.move(c.get('currentUser').id, c.req.valid('param').id, data.groupId, data.restore)
  return c.json(ApiResponse.success(record))
})
app.get('/:id/messages', zValidator('param', idSchema), async (c) => {
  const records = await ConversationService.listMessages(c.get('currentUser').id, c.req.valid('param').id, c.req.query())
  return c.json(ApiResponse.success(records))
})
app.post('/:id/messages', zValidator('param', idSchema), zValidator('json', messageSchema), async (c) => {
  const record = await ConversationService.createMessageForUser(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record, 'created', 201), 201)
})
app.delete('/:id/messages/:messageId', zValidator('param', messageIdSchema), async (c) => {
  const { id, messageId } = c.req.valid('param')
  await ConversationService.deleteMessage(c.get('currentUser').id, id, messageId)
  return c.json(ApiResponse.ok('deleted'))
})
app.get('/:id/skills', zValidator('param', idSchema), async (c) => {
  return c.json(ApiResponse.success(await ConversationService.listSkills(c.get('currentUser').id, c.req.valid('param').id, c.req.query())))
})
app.post('/:id/skills', zValidator('param', idSchema), zValidator('json', conversationSkillSchema), async (c) => {
  const record = await ConversationService.createSkill(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record, 'created', 201), 201)
})
app.patch('/:id/skills/:conversationSkillId', zValidator('param', skillIdSchema), zValidator('json', conversationSkillSchema.partial()), async (c) => {
  const params = c.req.valid('param')
  const record = await ConversationService.updateSkill(c.get('currentUser').id, params.id, params.conversationSkillId, c.req.valid('json'))
  return c.json(ApiResponse.success(record))
})
app.delete('/:id/skills/:conversationSkillId', zValidator('param', skillIdSchema), async (c) => {
  const params = c.req.valid('param')
  await ConversationService.deleteSkill(c.get('currentUser').id, params.id, params.conversationSkillId)
  return c.json(ApiResponse.ok('deleted'))
})

export default app
