import { z } from 'zod'
import { ModelCapability, RecordStatus } from '@prisma/client'
import { SkillService } from '../services/skill.service'
import { createAdminCrudRoute } from './adminCrud.route'

const skillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  capability: z.enum(ModelCapability).optional(),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional(),
  allowedModelIds: z.any().optional(),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

export default createAdminCrudRoute(SkillService, skillSchema, skillSchema.partial())
