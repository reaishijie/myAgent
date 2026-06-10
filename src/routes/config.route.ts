import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { ConfigAccessLevel, RecordStatus } from '@prisma/client'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { ConfigService } from '../services/config.service'
import { createAdminCrudRoute } from './adminCrud.route'

const configSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  group: z.string().min(1).max(50).default('default'),
  accessLevel: z.enum(ConfigAccessLevel).default(ConfigAccessLevel.ADMIN),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  description: z.string().optional(),
})

const updateConfigSchema = configSchema.partial()

export const configApp = new Hono<{ Variables: AppVariables }>()

configApp.get('/', async (c) => {
  const group = c.req.query('group')

  return c.json(ApiResponse.success(await ConfigService.listForUser(ConfigAccessLevel.PUBLIC, group)))
})

export const adminConfigApp = createAdminCrudRoute(
  ConfigService.admin,
  configSchema,
  updateConfigSchema,
)
