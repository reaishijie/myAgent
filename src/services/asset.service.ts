import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

const assetFilterKeys = [
  'type',
  'status',
  'generationJobId',
  'conversationId',
  'modelInvocationId',
  'modelId',
]

const buildAssetWhere = (filters: ResourceFilters = {}, userId?: number) => ({
  deletedAt: null,
  ...pickFilters(filters, [...assetFilterKeys, ...(userId ? [] : ['userId']), 'id']),
  ...(userId ? { userId } : {}),
  ...createdAtRange(filters),
})

export const AssetService = {
  list(userId: number, filters: ResourceFilters = {}) {
    return this.listForUser(getDb(), userId, filters)
  },

  listForUser(db: Pick<ReturnType<typeof getDb>, 'asset'>, userId: number, filters: ResourceFilters = {}) {
    return db.asset.findMany({
      where: buildAssetWhere(filters, userId),
      orderBy: { id: 'desc' },
    })
  },

  listForAdmin(db: Pick<ReturnType<typeof getDb>, 'asset'>, filters: ResourceFilters = {}) {
    return db.asset.findMany({
      where: buildAssetWhere(filters),
      orderBy: { id: 'desc' },
    })
  },

  async get(userId: number, id: number) {
    const record = await getDb().asset.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('asset not found', 'ASSET_NOT_FOUND')
    }
    return record
  },

  create(userId: number, data: Record<string, unknown>) {
    return getDb().asset.create({ data: { ...data, userId } as any })
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    await this.get(userId, id)
    return getDb().asset.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.get(userId, id)
    return getDb().asset.update({ where: { id }, data: { deletedAt: new Date() } })
  },
}
