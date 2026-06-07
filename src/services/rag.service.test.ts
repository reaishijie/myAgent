import { expect, test } from 'bun:test'
import { RagService, createRagService } from './rag.service'

test('createDocument chunks content, embeds chunks, and stores them', async () => {
  process.env.RAG_CHUNK_SIZE = '4'
  process.env.RAG_CHUNK_OVERLAP = '1'

  const calls: Array<{ method: string; args: unknown[] }> = []
  const db = {
    knowledgeDocument: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        calls.push({ method: 'createDocument', args: [data] })
        return { id: 7, title: data.title }
      },
    },
    knowledgeChunk: {
      count: async () => 0,
      findFirst: async () => null,
    },
    $executeRaw: async (...args: unknown[]) => {
      calls.push({ method: 'executeRaw', args })
      return undefined
    },
    $queryRaw: async () => {
      throw new Error('not used')
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({
      embeddings: (Array.isArray(input) ? input : [input]).map((_, index) => [index + 1, index + 2]),
      model: 'embedding-model',
    }),
    chat: async () => 'unused',
  })

  const result = await rag.createDocument({ title: '  demo  ', content: 'abcdefghij' })

  expect(result).toEqual({ id: 7, title: 'demo', chunkCount: 3, embeddingModel: 'embedding-model', duplicated: false })
  expect(calls[0]).toEqual({
    method: 'createDocument',
    args: [{ title: 'demo', content: 'abcdefghij', contentHash: expect.any(String) }],
  })
  expect(calls.filter((call) => call.method === 'executeRaw')).toHaveLength(3)
})

test('createDocument returns existing document when content hash already exists', async () => {
  let embedCalled = false
  let createCalled = false
  const db = {
    knowledgeDocument: {
      findUnique: async () => ({ id: 11, title: 'existing doc' }),
      create: async () => {
        createCalled = true
        throw new Error('create should not be called')
      },
    },
    knowledgeChunk: {
      count: async () => 2,
      findFirst: async () => ({ embeddingModel: 'embedding-model' }),
    },
    $executeRaw: async () => {
      throw new Error('insert should not be called')
    },
    $queryRaw: async () => {
      throw new Error('query should not be called')
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => {
      embedCalled = true
      return { embeddings: [[0.1, 0.2]], model: 'embedding-model' }
    },
    chat: async () => 'unused',
  })

  const result = await rag.createDocument({ title: 'new title', content: 'same content' })

  expect(embedCalled).toBe(false)
  expect(createCalled).toBe(false)
  expect(result).toEqual({
    id: 11,
    title: 'existing doc',
    chunkCount: 2,
    embeddingModel: 'embedding-model',
    duplicated: true,
  })
})

test('query returns empty sources without calling chat when no chunks exist', async () => {
  const db = {
    $queryRaw: async () => [],
  }

  let chatCalled = false
  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => {
      chatCalled = true
      return 'should not happen'
    },
  })

  const result = await rag.query({ question: '  what is rag?  ', topK: 5 })

  expect(chatCalled).toBe(false)
  expect(result).toEqual({ answer: '知识库中没有找到相关内容。', sources: [] })
})

test('query builds sources from retrieved chunks and calls chat', async () => {
  const db = {
    $queryRaw: async () => [
      { documentId: 1, title: 'doc', chunkIndex: 0, content: 'chunk one' },
      { documentId: 1, title: 'doc', chunkIndex: 1, content: 'chunk two' },
    ],
  }

  let prompt = ''
  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async (value: string) => {
      prompt = value
      return 'final answer'
    },
  })

  const result = await rag.query({ question: 'what is rag?', topK: 2 })

  expect(prompt).toContain('Context:')
  expect(prompt).toContain('可以根据上下文、中文常识或常见语言习惯进行合理推断')
  expect(prompt).toContain('必须明确说明这是推断')
  expect(prompt).toContain('chunk one')
  expect(prompt).toContain('Question: what is rag?')
  expect(result).toEqual({
    answer: 'final answer',
    sources: [
      { documentId: 1, title: 'doc', chunkIndex: 0, content: 'chunk one' },
      { documentId: 1, title: 'doc', chunkIndex: 1, content: 'chunk two' },
    ],
  })
})

test('RagService export is available', () => {
  expect(RagService).toBeDefined()
})
