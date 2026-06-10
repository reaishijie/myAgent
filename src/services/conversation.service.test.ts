import { describe, expect, test } from 'bun:test'
import { ConversationService } from './conversation.service'

describe('ConversationService', () => {
  test('create initializes conversation skills from user default skills', async () => {
    const createdConversation = { id: 10, userId: 1, title: 'New chat', status: 'ACTIVE' }
    const createdSkills: any[] = []
    const db = {
      conversation: {
        create: async () => createdConversation,
      },
      userDefaultSkill: {
        findMany: async () => [
          { userSkillId: 1, config: { enabled: true }, sort: 10, status: 'ENABLED' },
          { userSkillId: 2, config: null, sort: 20, status: 'ENABLED' },
        ],
      },
      conversationSkill: {
        createMany: async ({ data }: any) => {
          createdSkills.push(...data)
          return { count: data.length }
        },
      },
    }

    const result = await ConversationService.create(db as any, 1, { title: 'New chat' })

    expect(result).toEqual(createdConversation)
    expect(createdSkills).toEqual([
      { conversationId: 10, userSkillId: 1, config: { enabled: true }, sort: 10, status: 'ENABLED' },
      { conversationId: 10, userSkillId: 2, config: null, sort: 20, status: 'ENABLED' },
    ])
  })

  test('createMessage rejects archived conversations', async () => {
    const db = {
      conversation: {
        findFirst: async () => ({ id: 10, userId: 1, status: 'ARCHIVED' }),
      },
      conversationMessage: {
        create: async () => {
          throw new Error('should not create')
        },
      },
    }

    await expect(
      ConversationService.createMessage(db as any, 1, 10, {
        role: 'USER',
        contentType: 'TEXT',
        content: 'hello',
      }),
    ).rejects.toThrow('Archived conversations cannot be modified')
  })
})
