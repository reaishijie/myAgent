import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'

export const AssetService = {
  list(userId: number) {
    return getDb().asset.findMany({
      where: { userId, deletedAt: null },
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
