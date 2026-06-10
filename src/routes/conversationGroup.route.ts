import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { ConversationGroupType, RecordStatus } from '@prisma/client'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { authMiddleware } from '../middleware/auth.middleware'
import { ConversationGroupService } from '../services/conversationGroup.service'

const idSchema = z.object({ id: z.coerce.number().int().positive() })
const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ConversationGroupType).default(ConversationGroupType.NORMAL),
  sort: z.number().int().default(100),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
})

const app = new Hono<{ Variables: AppVariables }>()
app.use('*', authMiddleware())

app.get('/', async (c) => c.json(ApiResponse.success(await ConversationGroupService.list(c.get('currentUser').id))))
app.post('/', zValidator('json', schema), async (c) => {
  const record = await ConversationGroupService.create(c.get('currentUser').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record, 'created', 201), 201)
})
app.patch('/:id', zValidator('param', idSchema), zValidator('json', schema.partial()), async (c) => {
  const record = await ConversationGroupService.update(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record))
})
app.delete('/:id', zValidator('param', idSchema), async (c) => {
  await ConversationGroupService.softDelete(c.get('currentUser').id, c.req.valid('param').id)
  return c.json(ApiResponse.ok('deleted'))
})

export default app
