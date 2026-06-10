import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'

export const BillingRecordService = {
  list(userId: number) {
    return getDb().billingRecord.findMany({
      where: { userId, deletedAt: null },
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
