import { expect, test } from 'bun:test'
import { createWidgetService } from './widget.service'

test('widget service creates widget linked to a knowledge base', async () => {
  let createdData: any
  const db = {
    knowledgeBase: {
      findUnique: async () => ({ id: 9 }),
    },
    widget: {
      create: async ({ data }: any) => {
        createdData = data
        return { id: 'widget-1', ...data, createdAt: null, updatedAt: null }
      },
    },
  }

  const service = createWidgetService({ db: db as any })
  const result = await service.create({ knowledgeBaseId: 9, title: '  Help  ', botName: '  Bot  ', isEnabled: true })

  expect(createdData).toMatchObject({ knowledgeBaseId: 9, title: 'Help', botName: 'Bot', isEnabled: true })
  expect(result.id).toBe('widget-1')
})

test('widget service lists widgets by knowledge base', async () => {
  const calls: any[] = []
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => ({ id: where.id }),
    },
    widget: {
      findMany: async (query: any) => {
        calls.push(query)
        return [{ id: 'widget-2', knowledgeBaseId: 3, title: 'Help', botName: 'Bot', botAvatar: null, welcomeMessage: null, systemPrompt: null, isEnabled: true, createdAt: null, updatedAt: null }]
      },
    },
  }

  const service = createWidgetService({ db: db as any })
  const result = await service.listByKnowledgeBase(3)

  expect(calls[0]).toMatchObject({ where: { knowledgeBaseId: 3 }, orderBy: { updatedAt: 'desc' } })
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('widget-2')
})

test('widget public config excludes private fields', async () => {
  const db = {
    widget: {
      findFirst: async () => ({
        id: 'widget-1',
        knowledgeBaseId: 9,
        title: 'Help',
        botName: 'Bot',
        botAvatar: null,
        welcomeMessage: 'Hi',
      }),
    },
  }

  const service = createWidgetService({ db: db as any })
  const result = await service.getPublicConfig('widget-1')

  expect(result).toEqual({
    id: 'widget-1',
    knowledgeBaseId: 9,
    title: 'Help',
    botName: 'Bot',
    botAvatar: null,
    welcomeMessage: 'Hi',
  })
  expect(result).not.toHaveProperty('systemPrompt')
  expect(result).not.toHaveProperty('isEnabled')
})
