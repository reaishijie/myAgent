import { getDb } from '../db'
import { NotFoundException } from '../core/exceptions'

export const ConversationGroupService = {
  list(userId: number) {
    return getDb().conversationGroup.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sort: 'asc' }, { id: 'desc' }],
    })
  },

  create(userId: number, data: Record<string, unknown>) {
    return getDb().conversationGroup.create({ data: { ...data, userId } as any })
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    const record = await getDb().conversationGroup.findFirst({ where: { id, userId, deletedAt: null } })
    if (!record) {
      throw new NotFoundException('conversation group not found', 'CONVERSATION_GROUP_NOT_FOUND')
    }

    return getDb().conversationGroup.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    return this.update(userId, id, { deletedAt: new Date() })
  },
}
