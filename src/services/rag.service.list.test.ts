import { expect, test } from 'bun:test'
import { createRagService } from './rag.service'

test('rag service lists documents by category with pagination and chunk counts', async () => {
  const calls: any[] = []
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => ({ id: where.id }),
    },
    knowledgeDocument: {
      count: async (query: any) => {
        calls.push({ type: 'count', query })
        return 1
      },
      findMany: async (query: any) => {
        calls.push({ type: 'findMany', query })
        if (query.distinct) {
          return [{ category: 'Guide' }]
        }

        return [{
          id: 11,
          knowledgeBaseId: 4,
          category: 'Guide',
          title: 'Guide',
          fileName: 'guide.md',
          mimeType: 'text/markdown',
          fileSize: 128,
          parseStatus: 'COMPLETED',
          parseError: null,
          createdAt: null,
          updatedAt: null,
          _count: { chunks: 2 },
        }]
      },
    },
  }

  const service = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1]], model: 'test' }),
    chat: async () => ({ answer: 'ok' }),
    streamChat: async function* () {},
  })

  const result = await service.listDocuments({ knowledgeBaseId: 4, category: 'Guide', page: 2, pageSize: 5 })

  expect(calls[0]).toMatchObject({ type: 'count', query: { where: { knowledgeBaseId: 4, category: 'Guide' } } })
  expect(calls[1]).toMatchObject({
    type: 'findMany',
    query: {
      where: { knowledgeBaseId: 4, category: 'Guide' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    },
  })
  expect(result).toEqual({
    items: [{
      id: 11,
      knowledgeBaseId: 4,
      category: 'Guide',
      title: 'Guide',
      fileName: 'guide.md',
      mimeType: 'text/markdown',
      fileSize: 128,
      parseStatus: 'COMPLETED',
      parseError: null,
      createdAt: null,
      updatedAt: null,
      chunkCount: 2,
    }],
    pagination: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
    categories: ['Guide'],
  })
})
