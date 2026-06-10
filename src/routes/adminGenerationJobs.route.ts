import { z } from 'zod'
import { GenerationJobStatus } from '@prisma/client'
import { GenerationJobService } from '../services/generationJob.service'
import { createAdminResourceRoute } from './adminResource.route'

const updateGenerationJobSchema = z.object({
  status: z.enum(GenerationJobStatus).optional(),
  result: z.any().optional(),
  errorMessage: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  finishedAt: z.coerce.date().optional(),
})

export default createAdminResourceRoute(GenerationJobService, updateGenerationJobSchema)

