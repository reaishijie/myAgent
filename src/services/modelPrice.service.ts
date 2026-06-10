import { getDb } from '../db'
import { createFilteredCrudService } from './filteredCrud.service'

export const ModelPriceService = createFilteredCrudService(
  () => getDb().modelPrice,
  'model price',
  ['id', 'modelId', 'channelId', 'capability', 'unit', 'status'],
)
