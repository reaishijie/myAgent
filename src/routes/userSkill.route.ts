import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { RecordStatus, UserSkillSource } from '@prisma/client'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { authMiddleware } from '../middleware/auth.middleware'
import { UserSkillService } from '../services/userSkill.service'

const idSchema = z.object({ id: z.coerce.number().int().positive() })
const userSkillSchema = z.object({
  skillId: z.number().int().positive().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  source: z.enum(UserSkillSource).default(UserSkillSource.CUSTOM),
  config: z.any().optional(),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
})

const app = new Hono<{ Variables: AppVariables }>()
app.use('*', authMiddleware())

app.get('/', async (c) => c.json(ApiResponse.success(await UserSkillService.list(c.get('currentUser').id, c.req.query()))))
app.post('/', zValidator('json', userSkillSchema), async (c) => {
  const record = await UserSkillService.create(c.get('currentUser').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record, 'created', 201), 201)
})
app.patch('/:id', zValidator('param', idSchema), zValidator('json', userSkillSchema.partial()), async (c) => {
  const record = await UserSkillService.update(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
  return c.json(ApiResponse.success(record))
})
app.delete('/:id', zValidator('param', idSchema), async (c) => {
  await UserSkillService.softDelete(c.get('currentUser').id, c.req.valid('param').id)
  return c.json(ApiResponse.ok('deleted'))
})

export default app
