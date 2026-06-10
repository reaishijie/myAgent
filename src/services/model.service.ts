import { getDb } from '../db'
import { createCrudService } from './crud.service'

export const ModelService = createCrudService(() => getDb().model, 'model')
