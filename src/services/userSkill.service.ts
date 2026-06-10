import { RecordStatus } from '@prisma/client'
import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

export const UserSkillService = {
  list(userId: number, filters: ResourceFilters = {}) {
    return this.listForUser(getDb(), userId, filters)
  },

  listForUser(db: Pick<ReturnType<typeof getDb>, 'userSkill'>, userId: number, filters: ResourceFilters = {}) {
    return db.userSkill.findMany({
      where: {
        userId,
        deletedAt: null,
        ...pickFilters(filters, ['id', 'skillId', 'source', 'status']),
        ...createdAtRange(filters),
      },
      orderBy: { id: 'desc' },
    })
  },

  async get(userId: number, id: number) {
    const record = await getDb().userSkill.findFirst({
      where: { id, userId, deletedAt: null },
    })

    if (!record) {
      throw new NotFoundException('user skill not found', 'USER_SKILL_NOT_FOUND')
    }

    return record
  },

  create(userId: number, data: Record<string, unknown>) {
    return getDb().userSkill.create({
      data: { ...data, userId } as any,
    })
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    await this.get(userId, id)

    return getDb().userSkill.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.get(userId, id)

    return getDb().userSkill.update({
      where: { id },
      data: { deletedAt: new Date(), status: RecordStatus.DISABLED },
    })
  },
}
