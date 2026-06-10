import { LifecycleStatus, RecordStatus } from '@prisma/client'
import { getDb } from '../db'
import { BadRequestException, NotFoundException } from '../core/exceptions'

type ConversationDb = Pick<
  ReturnType<typeof getDb>,
  'conversation' | 'conversationMessage' | 'conversationSkill' | 'userDefaultSkill'
>

const ensureActiveConversation = async (db: ConversationDb, userId: number, conversationId: number) => {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId, deletedAt: null },
  })

  if (!conversation) {
    throw new NotFoundException('conversation not found', 'CONVERSATION_NOT_FOUND')
  }

  if (conversation.status === LifecycleStatus.ARCHIVED) {
    throw new BadRequestException('Archived conversations cannot be modified', 'CONVERSATION_ARCHIVED')
  }

  return conversation
}

export const ConversationService = {
  list(userId: number) {
    return getDb().conversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    })
  },

  async create(db: ConversationDb, userId: number, data: Record<string, unknown>) {
    const conversation = await db.conversation.create({
      data: { ...data, userId } as any,
    })
    const defaults = await db.userDefaultSkill.findMany({
      where: { userId, status: RecordStatus.ENABLED, deletedAt: null },
      orderBy: { sort: 'asc' },
    })

    if (defaults.length > 0) {
      await db.conversationSkill.createMany({
        data: defaults.map((skill: any) => ({
          conversationId: conversation.id,
          userSkillId: skill.userSkillId,
          config: skill.config,
          sort: skill.sort,
          status: skill.status,
        })),
        skipDuplicates: true,
      })
    }

    return conversation
  },

  createForUser(userId: number, data: Record<string, unknown>) {
    return this.create(getDb(), userId, data)
  },

  async get(userId: number, id: number) {
    const conversation = await getDb().conversation.findFirst({
      where: { id, userId, deletedAt: null },
    })

    if (!conversation) {
      throw new NotFoundException('conversation not found', 'CONVERSATION_NOT_FOUND')
    }

    return conversation
  },

  async update(userId: number, id: number, data: Record<string, unknown>) {
    await this.get(userId, id)

    return getDb().conversation.update({ where: { id }, data })
  },

  archive(userId: number, id: number) {
    return this.update(userId, id, { status: LifecycleStatus.ARCHIVED })
  },

  restore(userId: number, id: number) {
    return this.update(userId, id, { status: LifecycleStatus.ACTIVE })
  },

  async move(userId: number, id: number, groupId: number | null, restore = false) {
    const conversation = await this.get(userId, id)
    const data: Record<string, unknown> = { groupId }

    if (conversation.status === LifecycleStatus.ARCHIVED && restore) {
      data.status = LifecycleStatus.ACTIVE
    }

    return getDb().conversation.update({ where: { id }, data })
  },

  async softDelete(userId: number, id: number) {
    await this.get(userId, id)

    return getDb().conversation.update({
      where: { id },
      data: { status: LifecycleStatus.DELETED, deletedAt: new Date() },
    })
  },

  listMessages(userId: number, conversationId: number) {
    return getDb().conversationMessage.findMany({
      where: { conversationId, userId, deletedAt: null },
      orderBy: { id: 'asc' },
    })
  },

  async createMessage(db: ConversationDb, userId: number, conversationId: number, data: Record<string, unknown>) {
    await ensureActiveConversation(db, userId, conversationId)

    return db.conversationMessage.create({
      data: { ...data, userId, conversationId } as any,
    })
  },

  createMessageForUser(userId: number, conversationId: number, data: Record<string, unknown>) {
    return this.createMessage(getDb(), userId, conversationId, data)
  },

  async deleteMessage(userId: number, conversationId: number, messageId: number) {
    await this.get(userId, conversationId)

    return getDb().conversationMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    })
  },

  async listSkills(userId: number, conversationId: number) {
    await this.get(userId, conversationId)

    return getDb().conversationSkill.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { sort: 'asc' },
    })
  },

  async createSkill(userId: number, conversationId: number, data: Record<string, unknown>) {
    await ensureActiveConversation(getDb(), userId, conversationId)

    return getDb().conversationSkill.create({
      data: { ...data, conversationId } as any,
    })
  },

  async updateSkill(userId: number, conversationId: number, id: number, data: Record<string, unknown>) {
    await ensureActiveConversation(getDb(), userId, conversationId)

    return getDb().conversationSkill.update({ where: { id }, data })
  },

  async deleteSkill(userId: number, conversationId: number, id: number) {
    await ensureActiveConversation(getDb(), userId, conversationId)

    return getDb().conversationSkill.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },
}
