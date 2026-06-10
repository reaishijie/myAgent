import { describe, expect, test } from 'bun:test'
import { createUserService } from './user.service'

describe('UserService', () => {
  test('register creates an archive conversation group for the new user', async () => {
    const createdGroups: any[] = []
    const db = {
      user: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({
          id: 12,
          username: data.username,
          nickname: data.nickname,
          plan: 'FREE',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      conversationGroup: {
        create: async ({ data }: any) => {
          createdGroups.push(data)
          return { id: 1, ...data }
        },
      },
    }
    const service = createUserService({
      db: db as any,
      hashPassword: async () => 'hashed-password',
    })

    await service.register({
      username: 'alice',
      password: 'secret123',
      email: 'alice@example.com',
      nickname: 'Alice',
    })

    expect(createdGroups).toEqual([
      {
        userId: 12,
        name: 'Archive',
        type: 'ARCHIVE',
        sort: 9999,
      },
    ])
  })
})
