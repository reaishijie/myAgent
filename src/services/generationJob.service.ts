import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'

export const GenerationJobService = {
  list(userId: number) {
    return getDb().generationJob.findMany({
      where: { userId, deletedAt: null },
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
