import { describe, expect, test } from 'bun:test'
import { AssetService } from './asset.service'
import { ConversationService } from './conversation.service'
import { createFilteredCrudService } from './filteredCrud.service'
import { GenerationJobService } from './generationJob.service'
import { ModelInvocationService } from './modelInvocation.service'
import { pickFilters } from './queryFilters'
import { UserSkillService } from './userSkill.service'

const createDelegate = () => {
  const calls: any[] = []

  return {
    calls,
    delegate: {
      findMany: async (args: any) => {
        calls.push(args)
        return []
      },
      findFirst: async () => null,
      create: async ({ data }: any) => ({ id: 1, ...data }),
      update: async ({ where, data }: any) => ({ ...where, ...data }),
    },
  }
}

describe('query filters', () => {
  test('pickFilters ignores invalid numeric query values', () => {
    expect(pickFilters({ userId: 'abc', modelId: '2' }, ['userId', 'modelId'])).toEqual({
      modelId: 2,
    })
  })

  test('asset list applies owner and metadata filters', async () => {
    const { calls, delegate } = createDelegate()
    const db = { asset: delegate }

    await AssetService.listForUser(db as any, 7, {
      type: 'IMAGE',
      status: 'READY',
      generationJobId: 3,
      conversationId: 4,
      modelInvocationId: 5,
      startAt: new Date('2026-01-01T00:00:00.000Z'),
      endAt: new Date('2026-01-31T00:00:00.000Z'),
    })

    expect(calls[0].where).toEqual({
      userId: 7,
      deletedAt: null,
      type: 'IMAGE',
      status: 'READY',
      generationJobId: 3,
      conversationId: 4,
      modelInvocationId: 5,
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T00:00:00.000Z'),
      },
    })
  })

  test('admin asset list can filter by any user', async () => {
    const { calls, delegate } = createDelegate()
    const db = { asset: delegate }

    await AssetService.listForAdmin(db as any, { userId: 9, status: 'FAILED' })

    expect(calls[0].where).toEqual({
      deletedAt: null,
      userId: 9,
      status: 'FAILED',
    })
  })

  test('user asset list ignores userId query filters from another user', async () => {
    const { calls, delegate } = createDelegate()
    const db = { asset: delegate }

    await AssetService.listForUser(db as any, 7, { userId: 99, status: 'READY' })

    expect(calls[0].where).toEqual({
      userId: 7,
      deletedAt: null,
      status: 'READY',
    })
  })

  test('generation job list applies capability and status filters', async () => {
    const { calls, delegate } = createDelegate()
    const db = { generationJob: delegate }

    await GenerationJobService.listForUser(db as any, 8, {
      capability: 'IMAGE',
      status: 'SUCCESS',
      modelId: 2,
    })

    expect(calls[0].where).toEqual({
      userId: 8,
      deletedAt: null,
      capability: 'IMAGE',
      status: 'SUCCESS',
      modelId: 2,
    })
  })

  test('model invocation list applies model channel and status filters', async () => {
    const { calls, delegate } = createDelegate()
    const db = { modelInvocation: delegate }

    await ModelInvocationService.listForUser(db as any, 10, {
      conversationId: 1,
      modelId: 2,
      channelId: 3,
      capability: 'CHAT',
      status: 'FAILED',
    })

    expect(calls[0].where).toEqual({
      userId: 10,
      deletedAt: null,
      conversationId: 1,
      modelId: 2,
      channelId: 3,
      capability: 'CHAT',
      status: 'FAILED',
    })
  })

  test('admin model list applies capability status and date filters', async () => {
    const { calls, delegate } = createDelegate()
    const service = createFilteredCrudService(
      () => delegate as any,
      'model',
      ['capability', 'status'],
    )

    await service.list({
      capability: 'CHAT',
      status: 'ENABLED',
      startAt: '2026-01-01T00:00:00.000Z',
    })

    expect(calls[0].where).toEqual({
      capability: 'CHAT',
      status: 'ENABLED',
      createdAt: { gte: new Date('2026-01-01T00:00:00.000Z') },
      deletedAt: null,
    })
  })

  test('user skill list applies user-owned filters', async () => {
    const { calls, delegate } = createDelegate()
    const db = { userSkill: delegate }

    await UserSkillService.listForUser(db as any, 3, { skillId: '9', status: 'ENABLED' })

    expect(calls[0].where).toEqual({
      userId: 3,
      deletedAt: null,
      status: 'ENABLED',
      skillId: 9,
    })
  })

  test('conversation message filters support cursor and page size', async () => {
    const { calls, delegate } = createDelegate()
    const db = { conversationMessage: delegate }

    await ConversationService.listMessagesForUser(db as any, 4, 5, { beforeId: '20', pageSize: '10' })

    expect(calls[0]).toEqual({
      where: {
        conversationId: 5,
        userId: 4,
        deletedAt: null,
        id: { lt: 20 },
      },
      orderBy: { id: 'asc' },
      take: 10,
    })
  })
})
