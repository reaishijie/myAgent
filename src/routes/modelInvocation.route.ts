import { z } from 'zod'
import { InvocationStatus, ModelCapability } from '@prisma/client'
import { ModelInvocationService } from '../services/modelInvocation.service'
import { createUserResourceRoute } from './userResource.route'

const decimalLike = z.union([z.number(), z.string()])
const schema = z.object({
  conversationId: z.number().int().positive().optional(),
  modelId: z.number().int().positive().optional(),
  channelId: z.number().int().positive().optional(),
  capability: z.enum(ModelCapability),
  request: z.any().optional(),
  response: z.any().optional(),
  promptTokens: z.number().int().default(0),
  completionTokens: z.number().int().default(0),
  totalTokens: z.number().int().default(0),
  status: z.enum(InvocationStatus).default(InvocationStatus.PENDING),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  cost: decimalLike.optional(),
})

export default createUserResourceRoute(ModelInvocationService, schema, schema.partial())
