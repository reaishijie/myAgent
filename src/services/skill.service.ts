import { getDb } from '../db'
import { createCrudService } from './crud.service'

export const SkillService = createCrudService(() => getDb().skill, 'skill')
