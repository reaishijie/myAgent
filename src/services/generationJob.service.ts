import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

const generationJobFilterKeys = ['modelId', 'capability', 'status']

const buildGenerationJobWhere = (filters: ResourceFilters = {}, userId?: number) => ({
  deletedAt: null,
  ...pickFilters(filters, [...generationJobFilterKeys, ...(userId ? [] : ['userId']), 'id']),
  ...(userId ? { userId } : {}),
  ...createdAtRange(filters),
})

export const GenerationJobService = {
  list(userId: number, filters: ResourceFilters = {}) {
    return this.listForUser(getDb(), userId, filters)
  },

  listForUser(db: Pick<ReturnType<typeof getDb>, 'generationJob'>, userId: number, filters: ResourceFilters = {}) {
    return db.generationJob.findMany({
      where: buildGenerationJobWhere(filters, userId),
      orderBy: { id: 'desc' },
    })
  },

  listForAdmin(db: Pick<ReturnType<typeof getDb>, 'generationJob'>, filters: ResourceFilters = {}) {
    return db.generationJob.findMany({
      where: buildGenerationJobWhere(filters),
      orderBy: { id: 'desc' },
    })
  },

  async get(userId: number, id: number) {
    const record = await getDb().generationJob.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('generation job not found', 'GENERATION_JOB_NOT_FOUND')
    }
    return record
  },

  create(userId: number, data: Record<string, unknown>) {
    return getDb().generationJob.create({ data: { ...data, userId } as any })
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    await this.get(userId, id)
    return getDb().generationJob.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.get(userId, id)
    return getDb().generationJob.update({ where: { id }, data: { deletedAt: new Date() } })
  },
}
