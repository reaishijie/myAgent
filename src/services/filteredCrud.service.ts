import { getDb } from '../db'
import { createCrudService } from './crud.service'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

export const createFilteredCrudService = (
  delegateFactory: () => ReturnType<typeof getDb>[keyof ReturnType<typeof getDb>],
  name: string,
  keys: string[],
) => {
  const base = createCrudService(delegateFactory as any, name)

  return {
    ...base,
    list(filters: ResourceFilters = {}) {
      return base.list({
        ...pickFilters(filters, keys),
        ...createdAtRange(filters),
      })
    },
  }
}

