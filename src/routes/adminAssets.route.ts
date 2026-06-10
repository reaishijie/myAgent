import { z } from 'zod'
import { AssetService } from '../services/asset.service'
import { createAdminResourceRoute } from './adminResource.route'
import { AssetStatus } from '@prisma/client'

const updateAssetSchema = z.object({
  status: z.enum(AssetStatus).optional(),
  metadata: z.any().optional(),
})

export default createAdminResourceRoute(AssetService, updateAssetSchema)

