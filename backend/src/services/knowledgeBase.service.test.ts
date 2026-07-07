import { expect, test } from 'bun:test'
import { createKnowledgeBaseService } from './knowledgeBase.service'

test('knowledge base service creates and normalizes output counts', async () => {
  const db = {
    knowledgeBase: {
      create: async ({ data }: any) => ({
        id: 1,
        ...data,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        _count: { documents: 0, widgets: 0, sessions: 0 },
      }),
    },
  }

  const service = createKnowledgeBaseService({ db: db as any })
  const result = await service.create({ name: '  Demo KB  ', description: '  docs  ' })

  expect(result).toMatchObject({
    id: 1,
    name: 'Demo KB',
    description: 'docs',
    documentCount: 0,
    widgetCount: 0,
    sessionCount: 0,
  })
})

test('knowledge base service lists knowledge bases', async () => {
  const db = {
    knowledgeBase: {
      findMany: async () => [
        { id: 2, name: 'KB', description: null, createdAt: null, updatedAt: null, _count: { documents: 3, widgets: 1, sessions: 4 } },
      ],
    },
  }

  const service = createKnowledgeBaseService({ db: db as any })

  expect(await service.list()).toEqual([
    { id: 2, name: 'KB', description: null, createdAt: null, updatedAt: null, documentCount: 3, widgetCount: 1, sessionCount: 4 },
  ])
})
