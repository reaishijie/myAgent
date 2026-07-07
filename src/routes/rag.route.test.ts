import { expect, test } from 'bun:test'
import JSZip from 'jszip'
import { BadRequestException } from '../core/exceptions'
import { createApp } from '../app'
import { RagService, createRagService } from '../services/rag.service'
import { createRagApp } from './rag.route'

const createPdfBytes = () => new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Hello PDF RAG) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
405
%%EOF`)

const createDocxBytes = async () => {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.folder('_rels')?.file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.folder('word')?.file('document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX RAG</w:t></w:r></w:p></w:body></w:document>')

  return zip.generateAsync({ type: 'uint8array' })
}

const createRouteIntegrationHarness = () => {
  const documents: any[] = []
  const chunks: any[] = []
  let nextDocumentId = 1

  const db = {
    knowledgeBase: {
      findUnique: async ({ where }: any) => [1, 2].includes(where.id) ? { id: where.id } : null,
    },
    widget: {
      findFirst: async ({ where }: any) => where.id === 'widget-a' && where.isEnabled ? { knowledgeBaseId: 1 } : null,
    },
    knowledgeDocument: {
      findFirst: async ({ where }: any) => documents.find((document) => document.contentHash === where.contentHash && document.knowledgeBaseId === where.knowledgeBaseId) ?? null,
      create: async ({ data }: any) => {
        const document = { id: nextDocumentId++, ...data }
        documents.push(document)
        return { id: document.id, title: document.title, knowledgeBaseId: document.knowledgeBaseId }
      },
    },
    knowledgeChunk: {
      count: async ({ where }: any) => chunks.filter((chunk) => chunk.documentId === where.documentId).length,
      findFirst: async ({ where }: any) => chunks.find((chunk) => chunk.documentId === where.documentId) ?? null,
    },
    $executeRaw: async (_strings: TemplateStringsArray, documentId: number, chunkIndex: number, content: string, _embedding: string, embeddingModel: string, tokenCount: number) => {
      chunks.push({
        documentId,
        title: documents.find((document) => document.id === documentId)?.title,
        knowledgeBaseId: documents.find((document) => document.id === documentId)?.knowledgeBaseId,
        chunkIndex,
        content,
        embeddingModel,
        tokenCount,
      })
    },
    $queryRaw: async (query: any) => {
      const values = query.values ?? []
      const hasKnowledgeBaseFilter = typeof query.sql === 'string' && query.sql.includes('WHERE d.knowledge_base_id =')
      const knowledgeBaseId = hasKnowledgeBaseFilter ? values[1] : undefined
      const topK = values.at(-1) ?? 5

      return chunks
        .filter((chunk) => knowledgeBaseId === undefined || chunk.knowledgeBaseId === knowledgeBaseId)
        .slice(0, topK)
        .map((chunk) => ({ documentId: chunk.documentId, title: chunk.title, chunkIndex: chunk.chunkIndex, content: chunk.content }))
    },
  }

  const rag = createRagService({
    db: db as any,
    embed: async (input: string | string[]) => ({
      embeddings: (Array.isArray(input) ? input : [input]).map((_, index) => [index + 0.1, index + 0.2]),
      model: 'integration-embedding-model',
    }),
    chat: async () => ({ answer: 'integration answer' }),
    streamChat: async function* () {
      yield 'integration '
      yield 'answer'
    },
  })

  return { app: createRagApp(rag), documents, chunks }
}

test('rag route module imports', async () => {
  const route = await import('./rag.route')

  expect(route.default).toBeDefined()
})

test('rag route exposes stream query endpoint', async () => {
  const route = await import('./rag.route')
  const routes = (route.default as any).routes as Array<{ path: string; method: string }>

  expect(routes.some((item) => item.method === 'POST' && item.path === '/query/stream')).toBe(true)
})

test('rag route exposes plain document endpoint', async () => {
  const route = await import('./rag.route')
  const routes = (route.default as any).routes as Array<{ path: string; method: string }>

  expect(routes.some((item) => item.method === 'POST' && item.path === '/documents/plain')).toBe(true)
})

test('rag route exposes document list endpoint', async () => {
  const route = await import('./rag.route')
  const routes = (route.default as any).routes as Array<{ path: string; method: string }>

  expect(routes.some((item) => item.method === 'GET' && item.path === '/documents')).toBe(true)
})

test('rag route exposes multipart upload endpoint', async () => {
  const route = await import('./rag.route')
  const routes = (route.default as any).routes as Array<{ path: string; method: string }>

  expect(routes.some((item) => item.method === 'POST' && item.path === '/documents/upload')).toBe(true)
})

test('rag route integration uploads txt md pdf and docx through parser, chunker, embedding, and db writes', async () => {
  process.env.ADMIN_API_KEY = 'test-admin-key'
  const { app, documents, chunks } = createRouteIntegrationHarness()
  const fixtures = [
    { fileName: 'demo.txt', mimeType: 'text/plain', content: new TextEncoder().encode('TXT alpha knowledge') },
    { fileName: 'demo.md', mimeType: 'text/markdown', content: new TextEncoder().encode('# Markdown\n\nMD beta knowledge') },
    { fileName: 'demo.pdf', mimeType: 'application/pdf', content: createPdfBytes() },
    { fileName: 'demo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: await createDocxBytes() },
  ]

  try {
    for (const fixture of fixtures) {
      const form = new FormData()
      form.set('knowledgeBaseId', '1')
      form.set('file', new File([fixture.content], fixture.fileName, { type: fixture.mimeType }))

      const response = await app.request('/documents/upload', {
        method: 'POST',
        headers: { 'x-admin-api-key': 'test-admin-key' },
        body: form,
      })
      const json = await response.json() as any

      expect(response.status).toBe(201)
      expect(json.data).toMatchObject({ id: expect.any(Number), knowledgeBaseId: 1, embeddingModel: 'integration-embedding-model' })
      expect(Number(json.data.chunkCount)).toBeGreaterThan(0)
    }
  } finally {
    delete process.env.ADMIN_API_KEY
  }

  expect(documents).toHaveLength(4)
  expect(chunks).toHaveLength(4)
  expect(documents.map((document) => document.fileName)).toEqual(['demo.txt', 'demo.md', 'demo.pdf', 'demo.docx'])
  expect(documents.map((document) => document.metadata.format)).toEqual(['text', 'markdown', 'pdf', 'docx'])
  expect(documents.every((document) => document.fileHash && document.parseStatus === 'COMPLETED')).toBe(true)
  expect(documents.some((document) => 'buffer' in document || 'binary' in document)).toBe(false)
})

test('rag route integration queries uploaded data with sources, empty knowledge-base isolation, stream sources, and widget context', async () => {
  process.env.ADMIN_API_KEY = 'test-admin-key'
  const { app } = createRouteIntegrationHarness()

  try {
    const form = new FormData()
    form.set('knowledgeBaseId', '1')
    form.set('file', new File(['alpha searchable answer'], 'answer.txt', { type: 'text/plain' }))
    const uploadResponse = await app.request('/documents/upload', {
      method: 'POST',
      headers: { 'x-admin-api-key': 'test-admin-key' },
      body: form,
    })
    expect(uploadResponse.status).toBe(201)

    const queryResponse = await app.request('/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-api-key': 'test-admin-key' },
      body: JSON.stringify({ knowledgeBaseId: 1, question: 'alpha', topK: 3 }),
    })
    const queryJson = await queryResponse.json() as any
    expect(queryResponse.status).toBe(200)
    expect(queryJson.data.answer).toBe('integration answer')
    expect(queryJson.data.sources).toHaveLength(1)
    expect(queryJson.data.sources[0].content).toContain('alpha searchable answer')

    const emptyKbResponse = await app.request('/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-api-key': 'test-admin-key' },
      body: JSON.stringify({ knowledgeBaseId: 2, question: 'alpha', topK: 3 }),
    })
    const emptyKbJson = await emptyKbResponse.json() as any
    expect(emptyKbResponse.status).toBe(200)
    expect(emptyKbJson.data.sources).toEqual([])

    const widgetResponse = await app.request('/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ widgetId: 'widget-a', question: 'alpha', topK: 3 }),
    })
    const widgetJson = await widgetResponse.json() as any
    expect(widgetResponse.status).toBe(200)
    expect(widgetJson.data.sources).toHaveLength(1)

    const streamResponse = await app.request('/query/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-api-key': 'test-admin-key' },
      body: JSON.stringify({ knowledgeBaseId: 1, question: 'alpha', topK: 3 }),
    })
    const streamText = await streamResponse.text()
    const firstEvent = JSON.parse(streamText.split('\n\n')[0].replace('data: ', ''))

    expect(streamResponse.status).toBe(200)
    expect(firstEvent.type).toBe('sources')
    expect(firstEvent.sources).toHaveLength(1)
  } finally {
    delete process.env.ADMIN_API_KEY
  }
})

test('rag upload returns 4xx for unsupported file errors', async () => {
  process.env.ADMIN_API_KEY = 'test-admin-key'
  const original = RagService.createUploadedDocument
  RagService.createUploadedDocument = async () => {
    throw new BadRequestException('不支持的文件格式，仅支持 txt、md、pdf、docx', 'DOCUMENT_UNSUPPORTED_TYPE')
  }

  try {
    const form = new FormData()
    form.set('file', new File(['binary'], 'demo.png', { type: 'image/png' }))
    const response = await createApp().request('/api/rag/documents/upload', {
      method: 'POST',
      headers: { 'x-admin-api-key': 'test-admin-key' },
      body: form,
    })
    const json = await response.json() as any

    expect(response.status).toBe(400)
    expect(json.errorCode).toBe('DOCUMENT_UNSUPPORTED_TYPE')
  } finally {
    RagService.createUploadedDocument = original
    delete process.env.ADMIN_API_KEY
  }
})
