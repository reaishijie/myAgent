import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'

export const UserDefaultSkillService = {
  list(userId: number) {
    return getDb().userDefaultSkill.findMany({
      where: { userId, deletedAt: null },
      orderBy: { sort: 'asc' },
    })
  },

  create(userId: number, data: Record<string, unknown>) {
    return getDb().userDefaultSkill.create({
      data: { ...data, userId } as any,
    })
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    const record = await getDb().userDefaultSkill.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('default skill not found', 'DEFAULT_SKILL_NOT_FOUND')
    }

    return getDb().userDefaultSkill.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.update(userId, id, { deletedAt: new Date() })
  },
}
