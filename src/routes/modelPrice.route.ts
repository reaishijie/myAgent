import { z } from 'zod'
import { ModelCapability, PriceUnit, RecordStatus } from '@prisma/client'
import { ModelPriceService } from '../services/modelPrice.service'
import { createAdminCrudRoute } from './adminCrud.route'

const decimalLike = z.union([z.number(), z.string()])

const priceSchema = z.object({
  modelId: z.number().int().positive(),
  channelId: z.number().int().positive().optional(),
  capability: z.enum(ModelCapability),
  unit: z.enum(PriceUnit),
  inputPrice: decimalLike.optional(),
  outputPrice: decimalLike.optional(),
  price: decimalLike.optional(),
  currency: z.string().min(1).max(10).default('USD'),
  effectiveAt: z.coerce.date().optional(),
  expiredAt: z.coerce.date().optional(),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

export default createAdminCrudRoute(ModelPriceService, priceSchema, priceSchema.partial())
