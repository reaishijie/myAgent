import { z } from 'zod'
import { InvocationStatus } from '@prisma/client'
import { ModelInvocationService } from '../services/modelInvocation.service'
import { createAdminResourceRoute } from './adminResource.route'

const updateModelInvocationSchema = z.object({
  response: z.any().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  status: z.enum(InvocationStatus).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  cost: z.union([z.number(), z.string()]).optional(),
})

export default createAdminResourceRoute(ModelInvocationService, updateModelInvocationSchema)

