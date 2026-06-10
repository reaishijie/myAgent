import { BillingStatus } from '@prisma/client'
import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

type InvocationDb = Pick<ReturnType<typeof getDb>, 'modelInvocation' | 'billingRecord'>
type InvocationListDb = Pick<ReturnType<typeof getDb>, 'modelInvocation'>

const modelInvocationFilterKeys = ['conversationId', 'modelId', 'channelId', 'capability', 'status']

const buildModelInvocationWhere = (filters: ResourceFilters = {}, userId?: number) => ({
  deletedAt: null,
  ...pickFilters(filters, [...modelInvocationFilterKeys, ...(userId ? [] : ['userId']), 'id']),
  ...(userId ? { userId } : {}),
  ...createdAtRange(filters),
})

export const ModelInvocationService = {
  list(userId: number, filters: ResourceFilters = {}) {
    return this.listForUser(getDb(), userId, filters)
  },

  listForUser(db: InvocationListDb, userId: number, filters: ResourceFilters = {}) {
    return db.modelInvocation.findMany({
      where: buildModelInvocationWhere(filters, userId),
      orderBy: { id: 'desc' },
    })
  },

  listForAdmin(db: InvocationListDb, filters: ResourceFilters = {}) {
    return db.modelInvocation.findMany({
      where: buildModelInvocationWhere(filters),
      orderBy: { id: 'desc' },
    })
  },

  async get(userId: number, id: number) {
    const record = await getDb().modelInvocation.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('model invocation not found', 'MODEL_INVOCATION_NOT_FOUND')
    }
    return record
  },

  async create(db: InvocationDb, userId: number, data: Record<string, any>) {
    const invocation = await db.modelInvocation.create({
      data: { ...data, userId },
    })

    if (data.cost) {
      await db.billingRecord.create({
        data: {
          userId,
          modelInvocationId: invocation.id,
          modelId: data.modelId,
          channelId: data.channelId,
          capability: data.capability,
          amount: data.cost,
          status: BillingStatus.PENDING,
          detail: { totalTokens: data.totalTokens ?? 0 },
        },
      })
    }

    return invocation
  },

  createForUser(userId: number, data: Record<string, unknown>) {
    return this.create(getDb(), userId, data)
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    await this.get(userId, id)
    return getDb().modelInvocation.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.get(userId, id)
    return getDb().modelInvocation.update({ where: { id }, data: { deletedAt: new Date() } })
  },
}
