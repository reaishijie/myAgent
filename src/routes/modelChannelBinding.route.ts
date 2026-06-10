import { z } from 'zod'
import { RecordStatus } from '@prisma/client'
import { ModelChannelBindingService } from '../services/modelChannelBinding.service'
import { createAdminCrudRoute } from './adminCrud.route'

const bindingSchema = z.object({
  modelId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  priority: z.number().int().default(100),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

export default createAdminCrudRoute(ModelChannelBindingService, bindingSchema, bindingSchema.partial())
