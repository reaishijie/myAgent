import { getDb } from '../db'
import { createFilteredCrudService } from './filteredCrud.service'

export const ModelService = createFilteredCrudService(
  () => getDb().model,
  'model',
  ['id', 'capability', 'status'],
)
