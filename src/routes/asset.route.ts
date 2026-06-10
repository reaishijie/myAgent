import { z } from 'zod'
import { AssetStatus, AssetType } from '@prisma/client'
import { AssetService } from '../services/asset.service'
import { createUserResourceRoute } from './userResource.route'

const schema = z.object({
  generationJobId: z.number().int().positive().optional(),
  conversationId: z.number().int().positive().optional(),
  modelInvocationId: z.number().int().positive().optional(),
  modelId: z.number().int().positive().optional(),
  type: z.enum(AssetType),
  status: z.enum(AssetStatus).default(AssetStatus.PENDING),
  storageProvider: z.string().optional(),
  bucket: z.string().optional(),
  objectKey: z.string().optional(),
  url: z.string().url().optional(),
  mimeType: z.string().optional(),
  size: z.union([z.number(), z.string()]).optional(),
  metadata: z.any().optional(),
})

export default createUserResourceRoute(AssetService, schema, schema.partial())
