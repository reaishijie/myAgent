import { expect, test } from 'bun:test'
import { RagService, createRagService } from './rag.service'

test('createDocument chunks content, embeds chunks, and stores them', async () => {
  process.env.RAG_CHUNK_SIZE = '4'
  process.env.RAG_CHUNK_OVERLAP = '1'

  const calls: Array<{ method: string; args: unknown[] }> = []
  const db = {
    knowledgeDocument: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        calls.push({ method: 'createDocument', args: [data] })
        return { id: 7, title: data.title, knowledgeBaseId: data.knowledgeBaseId, category: data.category }
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
      usage: { promptTokens: 6, totalTokens: 6 },
    }),
    chat: async () => 'unused',
  })

  const result = await rag.createDocument({ title: '  demo  ', content: 'abcdefghij' })

  expect(result).toEqual({
    id: 7,
    title: 'demo',
    knowledgeBaseId: null,
    category: null,
    chunkCount: 3,
    embeddingModel: 'embedding-model',
    duplicated: false,
    usage: { embedding: { promptTokens: 6, totalTokens: 6 } },
  })
  expect(calls[0]).toEqual({
    method: 'createDocument',
    args: [{ title: 'demo', content: 'abcdefghij', contentHash: expect.any(String), knowledgeBaseId: null, category: null, parseStatus: 'COMPLETED', parseError: null }],
  })
  expect(calls.filter((call) => call.method === 'executeRaw')).toHaveLength(3)
})

test('createDocument writes knowledgeBaseId when provided', async () => {
  process.env.RAG_CHUNK_SIZE = '100'
  process.env.RAG_CHUNK_OVERLAP = '1'

  const calls: Array<{ method: string; args: unknown[] }> = []
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => where.id === 3 ? { id: 3 } : null,
    },
    knowledgeDocument: {
      findFirst: async ({ where }: any) => {
        calls.push({ method: 'findDocument', args: [where] })
        return null
      },
      create: async ({ data }: any) => {
        calls.push({ method: 'createDocument', args: [data] })
        return { id: 8, title: data.title, knowledgeBaseId: data.knowledgeBaseId, category: data.category }
      },
    },
    knowledgeChunk: {
      count: async () => 0,
      findFirst: async () => null,
    },
    $executeRaw: async () => undefined,
  }

  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({
      embeddings: (Array.isArray(input) ? input : [input]).map(() => [0.1, 0.2]),
      model: 'embedding-model',
    }),
    chat: async () => 'unused',
  })

  const result = await rag.createDocument({ title: 'doc', content: 'content', knowledgeBaseId: 3 })

  expect(calls[0]).toEqual({ method: 'findDocument', args: [{ contentHash: expect.any(String), knowledgeBaseId: 3 }] })
  expect(calls[1]).toEqual({ method: 'createDocument', args: [{ title: 'doc', content: 'content', contentHash: expect.any(String), knowledgeBaseId: 3, category: null, parseStatus: 'COMPLETED', parseError: null }] })
  expect(result.knowledgeBaseId).toBe(3)
})

test('createDocument allows same content in different knowledge bases', async () => {
  process.env.RAG_CHUNK_SIZE = '100'
  process.env.RAG_CHUNK_OVERLAP = '1'

  const createdData: any[] = []
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => ({ id: where.id }),
    },
    knowledgeDocument: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdData.push(data)
        return { id: createdData.length, title: data.title, knowledgeBaseId: data.knowledgeBaseId }
      },
    },
    knowledgeChunk: {
      count: async () => 0,
      findFirst: async () => null,
    },
    $executeRaw: async () => undefined,
  }

  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({
      embeddings: (Array.isArray(input) ? input : [input]).map(() => [0.1, 0.2]),
      model: 'embedding-model',
    }),
    chat: async () => 'unused',
  })

  await rag.createDocument({ title: 'doc a', content: 'same content', knowledgeBaseId: 1 })
  await rag.createDocument({ title: 'doc b', content: 'same content', knowledgeBaseId: 2 })

  expect(createdData).toHaveLength(2)
  expect(createdData[0]).toMatchObject({ knowledgeBaseId: 1, contentHash: expect.any(String) })
  expect(createdData[1]).toMatchObject({ knowledgeBaseId: 2, contentHash: createdData[0].contentHash })
})

test('createDocument deduplicates same content inside one knowledge base', async () => {
  let createCalled = false
  const db = {
    knowledgeBase: {
      findUnique: async () => ({ id: 3 }),
    },
    knowledgeDocument: {
      findFirst: async ({ where }: any) => where.knowledgeBaseId === 3 ? { id: 12, title: 'existing doc', knowledgeBaseId: 3 } : null,
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
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
  })

  const result = await rag.createDocument({ title: 'new title', content: 'same content', knowledgeBaseId: 3 })

  expect(createCalled).toBe(false)
  expect(result).toMatchObject({ id: 12, title: 'existing doc', knowledgeBaseId: 3, duplicated: true })
})

test('createDocument returns existing document when content hash already exists', async () => {
  let embedCalled = false
  let createCalled = false
  const db = {
    knowledgeDocument: {
      findFirst: async () => ({ id: 11, title: 'existing doc', knowledgeBaseId: null }),
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
    knowledgeBaseId: null,
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
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model', usage: { promptTokens: 4, totalTokens: 4 } }),
    chat: async () => {
      chatCalled = true
      return 'should not happen'
    },
  })

  const result = await rag.query({ question: '  what is rag?  ', topK: 5 })

  expect(chatCalled).toBe(false)
  expect(result).toEqual({
    answer: '知识库中没有找到相关内容。',
    sources: [],
    usage: { embedding: { promptTokens: 4, totalTokens: 4 } },
  })
})

test('query filters retrieved chunks by knowledgeBaseId when provided', async () => {
  let capturedSql = ''
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => where.id === 5 ? { id: 5 } : null,
    },
    $queryRaw: async (query: any) => {
      capturedSql = query.sql
      return []
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
  })

  await rag.query({ question: 'what is rag?', topK: 2, knowledgeBaseId: 5 })

  expect(capturedSql).toContain('WHERE d.knowledge_base_id =')
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
    embed: async (input: string | string[]) => ({
      embeddings: [[0.1, 0.2]],
      model: 'embedding-model',
      usage: { promptTokens: 4, totalTokens: 4 },
    }),
    chat: async (value: string) => {
      prompt = value
      return {
        answer: 'final answer',
        usage: { promptTokens: 20, completionTokens: 3, totalTokens: 23 },
      }
    },
  })

  const result = await rag.query({ question: 'what is rag?', topK: 2 })

  expect(prompt).toContain('Context:')
  expect(prompt).toContain('开门见山，直接给出答案')
  expect(prompt).toContain('不要使用“根据提供的上下文”')
  expect(prompt).toContain('明确说明这是推断')
  expect(prompt).toContain('chunk one')
  expect(prompt).toContain('Question: what is rag?')
  expect(result).toEqual({
    answer: 'final answer',
    sources: [
      { documentId: 1, title: 'doc', chunkIndex: 0, content: 'chunk one' },
      { documentId: 1, title: 'doc', chunkIndex: 1, content: 'chunk two' },
    ],
    usage: {
      embedding: { promptTokens: 4, totalTokens: 4 },
      chat: { promptTokens: 20, completionTokens: 3, totalTokens: 23 },
    },
  })
})

test('queryStream yields sources before chat deltas', async () => {
  const db = {
    $queryRaw: async () => [
      { documentId: 1, title: 'doc', chunkIndex: 0, content: 'chunk one' },
    ],
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
    streamChat: async function* () {
      yield '你'
      yield '好'
    },
  })

  const events = []
  for await (const event of rag.queryStream({ question: 'what is rag?', topK: 1 })) {
    events.push(event)
  }

  expect(events).toEqual([
    { type: 'sources', sources: [{ documentId: 1, title: 'doc', chunkIndex: 0, content: 'chunk one' }] },
    { type: 'delta', content: '你' },
    { type: 'delta', content: '好' },
    { type: 'done' },
  ])
})

test('queryStream filters retrieved chunks by knowledgeBaseId when provided', async () => {
  let capturedSql = ''
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => where.id === 6 ? { id: 6 } : null,
    },
    $queryRaw: async (query: any) => {
      capturedSql = query.sql
      return []
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
    streamChat: async function* () {},
  })

  for await (const _event of rag.queryStream({ question: 'what is rag?', topK: 1, knowledgeBaseId: 6 })) {
    // drain stream
  }

  expect(capturedSql).toContain('WHERE d.knowledge_base_id =')
})

test('queryStream filters retrieved chunks by document category when provided', async () => {
  let capturedSql = ''
  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => where.id === 6 ? { id: 6 } : null,
    },
    $queryRaw: async (query: any) => {
      capturedSql = query.sql
      return []
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
    streamChat: async function* () {},
  })

  for await (const _event of rag.queryStream({ question: 'what is rag?', topK: 1, knowledgeBaseId: 6, category: 'Guide' })) {
    // drain stream
  }

  expect(capturedSql).toContain('d.category =')
  expect(capturedSql).toContain('AND')
})

test('createUploadedDocument parses file and stores upload metadata without binary', async () => {
  const createdData: any[] = []
  const db = {
    knowledgeBase: {
      findUnique: async () => ({ id: 2 }),
    },
    knowledgeDocument: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdData.push(data)
        return { id: 21, title: data.title, knowledgeBaseId: data.knowledgeBaseId }
      },
    },
    knowledgeChunk: {
      count: async () => 0,
      findFirst: async () => null,
    },
    $executeRaw: async () => undefined,
  }

  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({
      embeddings: (Array.isArray(input) ? input : [input]).map(() => [0.1, 0.2]),
      model: 'embedding-model',
    }),
    chat: async () => 'unused',
  })

  const result = await rag.createUploadedDocument({
    fileName: 'demo.txt',
    mimeType: 'text/plain',
    fileSize: 11,
    buffer: new TextEncoder().encode('hello world'),
    knowledgeBaseId: 2,
  })

  expect(result).toMatchObject({ id: 21, title: 'demo.txt', knowledgeBaseId: 2, chunkCount: 1 })
  expect(createdData[0]).toMatchObject({
    content: 'hello world',
    fileName: 'demo.txt',
    mimeType: 'text/plain',
    fileSize: 11,
    fileHash: expect.any(String),
    parseStatus: 'COMPLETED',
  })
  expect(createdData[0].metadata).toMatchObject({ parser: 'text-decoder', fileName: 'demo.txt' })
  expect(createdData[0].buffer).toBeUndefined()
})

test('query resolves knowledge base from widgetId', async () => {
  let capturedSql = ''
  const db = {
    widget: {
      findFirst: async ({ where }: any) => where.id === 'widget_1' ? { knowledgeBaseId: 9 } : null,
    },
    $queryRaw: async (query: any) => {
      capturedSql = query.sql
      return []
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
  })

  await rag.query({ question: 'what is rag?', topK: 2, widgetId: 'widget_1' })

  expect(capturedSql).toContain('WHERE d.knowledge_base_id =')
})

test('query uses hybrid retrieval SQL with vector and keyword scoring', async () => {
  let capturedSql = ''
  const db = {
    $queryRaw: async (query: any) => {
      capturedSql = query.sql
      return []
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async () => ({ embeddings: [[0.1, 0.2]], model: 'embedding-model' }),
    chat: async () => 'unused',
  })

  await rag.query({ question: 'hybrid keyword', topK: 3 })

  expect(capturedSql).toContain('vector_matches')
  expect(capturedSql).toContain('keyword_matches')
  expect(capturedSql).toContain('ts_rank_cd')
})

test('RagService export is available', () => {
  expect(RagService).toBeDefined()
})
