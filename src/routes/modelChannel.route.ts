import { z } from 'zod'
import { ChannelProtocol, RecordStatus } from '@prisma/client'
import { ModelChannelService } from '../services/modelChannel.service'
import { createAdminCrudRoute } from './adminCrud.route'

const modelChannelSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url().max(500),
  apiKey: z.string().min(1),
  provider: z.string().min(1).max(50),
  protocol: z.enum(ChannelProtocol).default(ChannelProtocol.OPENAI_COMPATIBLE),
  status: z.enum(RecordStatus).default(RecordStatus.ENABLED),
  remark: z.string().optional(),
})

const updateModelChannelSchema = modelChannelSchema.partial()

export default createAdminCrudRoute(
  ModelChannelService,
  modelChannelSchema,
  updateModelChannelSchema,
)
