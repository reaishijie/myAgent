import { z } from 'zod'
import { PluginAuthType, RecordStatus } from '@prisma/client'
import { PluginService } from '../services/plugin.service'
import { createAdminCrudRoute } from './adminCrud.route'

const pluginSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  endpoint: z.string().url().max(500).optional(),
  authType: z.enum(PluginAuthType).default(PluginAuthType.NONE),
  paramSchema: z.any().optional(),
  config: z.any().optional(),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

export default createAdminCrudRoute(PluginService, pluginSchema, pluginSchema.partial())

