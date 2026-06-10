import { getDb } from '../db'
import { createFilteredCrudService } from './filteredCrud.service'

export const SkillService = createFilteredCrudService(
  () => getDb().skill,
  'skill',
  ['id', 'capability', 'status'],
)
