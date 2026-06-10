import { getDb } from '../db'
import { createCrudService } from './crud.service'
import { pickFilters, type ResourceFilters } from './queryFilters'

export const createPluginService = (delegateFactory = () => getDb().plugin) => ({
  base: createCrudService(delegateFactory, 'plugin'),

  list(filters: ResourceFilters = {}) {
    return this.base.list(pickFilters(filters, ['status', 'authType']))
  },

  get(id: number) {
    return this.base.get(id)
  },

  create(data: Record<string, unknown>) {
    return this.base.create(data)
  },

  update(id: number, data: Record<string, unknown>) {
    return this.base.update(id, data)
  },

  softDelete(id: number) {
    return this.base.softDelete(id)
  },
})

export const PluginService = createPluginService()

