import { getDb } from '../db'
import { createFilteredCrudService } from './filteredCrud.service'

export const ModelChannelBindingService = createFilteredCrudService(
  () => getDb().modelChannelBinding,
  'model channel binding',
  ['id', 'modelId', 'channelId', 'status'],
)
