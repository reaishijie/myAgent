import { z } from 'zod'
import { ModelCapability, RecordStatus } from '@prisma/client'
import { ModelService } from '../services/model.service'
import { createAdminCrudRoute } from './adminCrud.route'

const modelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  model: z.string().min(1).max(100),
  capability: z.enum(ModelCapability),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

export default createAdminCrudRoute(ModelService, modelSchema, modelSchema.partial())
