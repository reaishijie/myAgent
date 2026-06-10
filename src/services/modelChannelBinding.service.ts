import { getDb } from '../db'
import { createCrudService } from './crud.service'

export const ModelChannelBindingService = createCrudService(
  () => getDb().modelChannelBinding,
  'model channel binding',
)
