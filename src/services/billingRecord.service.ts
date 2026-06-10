import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

const billingRecordFilterKeys = ['modelInvocationId', 'modelId', 'channelId', 'capability', 'status']

const buildBillingRecordWhere = (filters: ResourceFilters = {}, userId?: number) => ({
  deletedAt: null,
  ...pickFilters(filters, [...billingRecordFilterKeys, ...(userId ? [] : ['userId']), 'id']),
  ...(userId ? { userId } : {}),
  ...createdAtRange(filters),
})

export const BillingRecordService = {
  list(userId: number, filters: ResourceFilters = {}) {
    return this.listForUser(getDb(), userId, filters)
  },

  listForUser(db: Pick<ReturnType<typeof getDb>, 'billingRecord'>, userId: number, filters: ResourceFilters = {}) {
    return db.billingRecord.findMany({
      where: buildBillingRecordWhere(filters, userId),
      orderBy: { id: 'desc' },
    })
  },

  listForAdmin(db: Pick<ReturnType<typeof getDb>, 'billingRecord'>, filters: ResourceFilters = {}) {
    return db.billingRecord.findMany({
      where: buildBillingRecordWhere(filters),
      orderBy: { id: 'desc' },
    })
  },

  async get(userId: number, id: number) {
    const record = await getDb().billingRecord.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('billing record not found', 'BILLING_RECORD_NOT_FOUND')
    }
    return record
  },
}
