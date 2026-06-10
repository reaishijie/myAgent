import { getDb } from '../db'
import { createCrudService } from './crud.service'

export const ModelPriceService = createCrudService(() => getDb().modelPrice, 'model price')
