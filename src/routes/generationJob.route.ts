import { z } from 'zod'
import { GenerationJobStatus, ModelCapability } from '@prisma/client'
import { GenerationJobService } from '../services/generationJob.service'
import { createUserResourceRoute } from './userResource.route'

const schema = z.object({
  modelId: z.number().int().positive().optional(),
  capability: z.enum(ModelCapability),
  status: z.enum(GenerationJobStatus).default(GenerationJobStatus.PENDING),
  request: z.any().optional(),
  result: z.any().optional(),
  errorMessage: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  finishedAt: z.coerce.date().optional(),
})

export default createUserResourceRoute(GenerationJobService, schema, schema.partial())
