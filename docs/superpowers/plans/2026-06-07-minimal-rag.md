# Minimal RAG MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a synchronous minimal RAG API that ingests JSON text documents, stores pgvector embeddings in PostgreSQL, retrieves relevant chunks, and answers with an OpenAI-compatible chat model.

**Architecture:** Keep route handlers thin and place orchestration in `rag.service.ts`. Use small provider services for chat and embedding, with independent base URLs, keys, and models. Use Prisma for normal models and raw SQL for pgvector insertion/search.

**Tech Stack:** Bun, Hono, TypeScript, Zod, Prisma 7, PostgreSQL, pgvector, OpenAI-compatible `/embeddings` and `/chat/completions` APIs.

---

## File Structure

- Create `src/utils/chunkText.ts`: deterministic character-based chunking.
- Create `src/utils/chunkText.test.ts`: unit coverage for chunking behavior.
- Create `src/services/openaiCompatible.ts`: shared URL normalization, response parsing, and typed fetch wrapper helpers.
- Create `src/services/embedding.service.ts`: embedding-only config and embeddings API call.
- Create `src/services/llm.service.ts`: chat-only config and chat completions API call.
- Create `src/services/rag.service.ts`: document ingestion and query orchestration.
- Create `src/routes/rag.route.ts`: Zod validation and HTTP endpoints.
- Modify `src/routes/index.ts`: mount `/rag` route.
- Modify `prisma/schema.prisma`: add `KnowledgeDocument` and `KnowledgeChunk` Prisma models, with vector stored through an unsupported/raw column strategy.
- Create `prisma/migrations/20260607000000_add_rag_tables/migration.sql`: enable pgvector, create vector column/index, and preserve Prisma-managed fields.
- Modify `.env.example` if present: document chat, embedding, and chunk settings.
- Modify or add import-safety test: verify the app/worker still imports without `DATABASE_URL` at module load time.

---

### Task 1: Add Chunking Utility

**Files:**
- Create: `src/utils/chunkText.ts`
- Create: `src/utils/chunkText.test.ts`

- [ ] **Step 1: Write the failing chunk tests**

Create `src/utils/chunkText.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { chunkText } from './chunkText'

test('chunkText returns one trimmed chunk when text fits', () => {
  expect(chunkText('  hello rag  ', { chunkSize: 20, overlap: 5 })).toEqual(['hello rag'])
})

test('chunkText splits text with overlap', () => {
  expect(chunkText('abcdefghij', { chunkSize: 4, overlap: 1 })).toEqual(['abcd', 'defg', 'ghij'])
})

test('chunkText skips whitespace-only input', () => {
  expect(chunkText('   ', { chunkSize: 4, overlap: 1 })).toEqual([])
})

test('chunkText rejects invalid overlap', () => {
  expect(() => chunkText('abcdef', { chunkSize: 4, overlap: 4 })).toThrow('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE')
})
```

- [ ] **Step 2: Run the failing test**

Run: `bun test src/utils/chunkText.test.ts`

Expected: FAIL because `src/utils/chunkText.ts` does not exist.

- [ ] **Step 3: Implement `chunkText`**

Create `src/utils/chunkText.ts`:

```ts
export interface ChunkTextOptions {
  chunkSize?: number
  overlap?: number
}

const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_OVERLAP = 120

export const chunkText = (text: string, options: ChunkTextOptions = {}) => {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = options.overlap ?? DEFAULT_OVERLAP

  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('RAG_CHUNK_SIZE must be a positive integer')
  }

  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('RAG_CHUNK_OVERLAP must be a non-negative integer')
  }

  if (overlap >= chunkSize) {
    throw new Error('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE')
  }

  const normalized = text.trim()
  if (!normalized) return []

  const chunks: string[] = []
  const step = chunkSize - overlap


  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + chunkSize).trim()
    if (chunk) chunks.push(chunk)
    if (start + chunkSize >= normalized.length) break
  }

  return chunks
}
```

- [ ] **Step 4: Run the test and commit**

Run: `bun test src/utils/chunkText.test.ts`

Expected: PASS.

Commit:

```bash
git add src/utils/chunkText.ts src/utils/chunkText.test.ts
git commit -m "add rag text chunking"
```

---

### Task 2: Add OpenAI-Compatible Provider Services

**Files:**
- Create: `src/services/openaiCompatible.ts`
- Create: `src/services/embedding.service.ts`
- Create: `src/services/llm.service.ts`

- [ ] **Step 1: Create shared provider helpers**

Create `src/services/openaiCompatible.ts`:

```ts
import { BusinessException } from '../core/exceptions'

export type FetchLike = typeof fetch

export const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

export const requireConfig = (value: string | undefined, name: string) => {
  if (!value) {
    throw new BusinessException(`Missing required environment variable: ${name}`, 500, 'MODEL_CONFIG_MISSING')
  }

  return value
}

export const readJsonResponse = async <T>(response: Response, providerName: string): Promise<T> => {
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new BusinessException(`${providerName} API request failed`, 502, 'MODEL_API_FAILED')
  }

  return body as T
}
```

- [ ] **Step 2: Create embedding service**

Create `src/services/embedding.service.ts`:

```ts
import { BusinessException } from '../core/exceptions'
import { normalizeBaseUrl, readJsonResponse, requireConfig, type FetchLike } from './openaiCompatible'

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>
  model?: string
}

export const EmbeddingService = {
  async embed(input: string | string[], fetchImpl: FetchLike = fetch) {
    const apiKey = requireConfig(process.env.OPENAI_EMBEDDING_API_KEY, 'OPENAI_EMBEDDING_API_KEY')
    const baseUrl = normalizeBaseUrl(requireConfig(process.env.OPENAI_EMBEDDING_BASE_URL, 'OPENAI_EMBEDDING_BASE_URL'))
    const model = requireConfig(process.env.OPENAI_EMBEDDING_MODEL, 'OPENAI_EMBEDDING_MODEL')

    const response = await fetchImpl(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
    })

    const body = await readJsonResponse<EmbeddingResponse>(response, 'Embedding')
    const embeddings = body.data.map((item) => item.embedding)

    if (embeddings.length === 0) {
      throw new BusinessException('Embedding API returned no vectors', 502, 'EMBEDDING_EMPTY')
    }

    return { embeddings, model }
  },
}
```

- [ ] **Step 3: Create chat service**

Create `src/services/llm.service.ts`:

```ts
import { BusinessException } from '../core/exceptions'
import { normalizeBaseUrl, readJsonResponse, requireConfig, type FetchLike } from './openaiCompatible'

interface ChatResponse {
  choices: Array<{ message?: { content?: string } }>
}

export const LlmService = {
  async chat(prompt: string, fetchImpl: FetchLike = fetch) {
    const apiKey = requireConfig(process.env.OPENAI_CHAT_API_KEY, 'OPENAI_CHAT_API_KEY')
    const baseUrl = normalizeBaseUrl(requireConfig(process.env.OPENAI_CHAT_BASE_URL, 'OPENAI_CHAT_BASE_URL'))
    const model = requireConfig(process.env.OPENAI_CHAT_MODEL, 'OPENAI_CHAT_MODEL')

    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    })

    const body = await readJsonResponse<ChatResponse>(response, 'Chat')
    const answer = body.choices[0]?.message?.content?.trim()

    if (!answer) {
      throw new BusinessException('Chat API returned no answer', 502, 'CHAT_EMPTY')
    }

    return answer
  },
}
```

- [ ] **Step 4: Run import safety tests and commit**

Run: `bun test src/worker.test.ts`

Expected: PASS.

Commit:

```bash
git add src/services/openaiCompatible.ts src/services/embedding.service.ts src/services/llm.service.ts
git commit -m "add openai compatible model services"
```

---

### Task 3: Add RAG Database Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260607000000_add_rag_tables/migration.sql`

- [ ] **Step 1: Add Prisma models**

Append to `prisma/schema.prisma`:

```prisma
model KnowledgeDocument {
  id        Int              @id @default(autoincrement())
  title     String           @db.VarChar(120)
  content   String
  metadata  Json?
  createdAt DateTime?        @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt DateTime?        @default(now()) @updatedAt @map("updated_at") @db.Timestamp(6)
  chunks    KnowledgeChunk[]

  @@index([createdAt], map: "knowledge_document_created_idx")
  @@map("knowledge_documents")
}

model KnowledgeChunk {
  id             Int               @id @default(autoincrement())
  documentId     Int               @map("document_id")
  chunkIndex     Int               @map("chunk_index")
  content        String
  embeddingModel String            @map("embedding_model") @db.VarChar(120)
  tokenCount     Int?              @map("token_count")
  createdAt      DateTime?         @default(now()) @map("created_at") @db.Timestamp(6)
  document       KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex], map: "knowledge_chunk_document_index_unique")
  @@index([documentId], map: "knowledge_chunk_document_idx")
  @@map("knowledge_chunks")
}
```

- [ ] **Step 2: Create pgvector migration SQL**

Create `prisma/migrations/20260607000000_add_rag_tables/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_documents" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(120) NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "knowledge_chunks" (
  "id" SERIAL PRIMARY KEY,
  "document_id" INTEGER NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector NOT NULL,
  "embedding_model" VARCHAR(120) NOT NULL,
  "token_count" INTEGER,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "knowledge_document_created_idx" ON "knowledge_documents"("created_at");
CREATE UNIQUE INDEX "knowledge_chunk_document_index_unique" ON "knowledge_chunks"("document_id", "chunk_index");
CREATE INDEX "knowledge_chunk_document_idx" ON "knowledge_chunks"("document_id");
CREATE INDEX "knowledge_chunk_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
```

The MVP intentionally uses `vector` without a fixed dimension so chat and embedding providers can be swapped during learning. If the selected embedding model is fixed for production, change this to `vector(1536)` or the provider's exact dimension and regenerate the migration.

- [ ] **Step 3: Generate Prisma client and commit**

Run: `bun run db:generate`

Expected: Prisma client generation succeeds.

Commit:

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "add rag database schema"
```

---

### Task 4: Implement RAG Service

**Files:**
- Create: `src/services/rag.service.ts`

- [ ] **Step 1: Create RAG service implementation**

Create `src/services/rag.service.ts`:

```ts
import { Prisma } from '@prisma/client'
import { BadRequestException } from '../core/exceptions'
import { getDb } from '../db'
import { chunkText } from '../utils/chunkText'
import { EmbeddingService } from './embedding.service'
import { LlmService } from './llm.service'

interface CreateDocumentInput {
  title: string
  content: string
}

interface QueryInput {
  question: string
  topK: number
}

interface RetrievedChunk {
  documentId: number
  title: string
  chunkIndex: number
  content: string
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value ? Number(value) : fallback
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const vectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

const buildPrompt = (question: string, chunks: RetrievedChunk[]) => {
  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n')

  return `You are a question-answering assistant. Answer using only the provided context. If the context does not contain the answer, say that the knowledge base does not contain relevant information.\n\nContext:\n${context}\n\nQuestion: ${question}`
}

export const RagService = {
  async createDocument(input: CreateDocumentInput) {
    const title = input.title.trim()
    const content = input.content.trim()

    if (!content) {
      throw new BadRequestException('文档内容不能为空', 'RAG_DOCUMENT_EMPTY')
    }

    const chunkSize = parsePositiveInt(process.env.RAG_CHUNK_SIZE, 800)
    const overlap = parsePositiveInt(process.env.RAG_CHUNK_OVERLAP, 120)
    const chunks = chunkText(content, { chunkSize, overlap })

    if (chunks.length === 0) {
      throw new BadRequestException('文档内容不能为空', 'RAG_DOCUMENT_EMPTY')
    }

    const { embeddings, model } = await EmbeddingService.embed(chunks)
    const db = getDb()
    const document = await db.knowledgeDocument.create({ data: { title, content } })

    for (const [index, chunk] of chunks.entries()) {
      await db.$executeRaw`
        INSERT INTO knowledge_chunks (document_id, chunk_index, content, embedding, embedding_model, token_count)
        VALUES (${document.id}, ${index}, ${chunk}, ${vectorLiteral(embeddings[index])}::vector, ${model}, ${chunk.length})
      `
    }

    return {
      id: document.id,
      title: document.title,
      chunkCount: chunks.length,
      embeddingModel: model,
    }
  },

  async query(input: QueryInput) {
    const question = input.question.trim()
    if (!question) {
      throw new BadRequestException('问题不能为空', 'RAG_QUESTION_EMPTY')
    }

    const { embeddings } = await EmbeddingService.embed(question)
    const queryVector = vectorLiteral(embeddings[0])
    const db = getDb()

    const chunks = await db.$queryRaw<RetrievedChunk[]>(Prisma.sql`
      SELECT
        c.document_id AS "documentId",
        d.title AS "title",
        c.chunk_index AS "chunkIndex",
        c.content AS "content"
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${input.topK}
    `)

    if (chunks.length === 0) {
      return {
        answer: '知识库中没有找到相关内容。',
        sources: [],
      }
    }

    const answer = await LlmService.chat(buildPrompt(question, chunks))

    return { answer, sources: chunks }
  },
}
```

- [ ] **Step 2: Run type/import tests and commit**

Run: `bun test src/worker.test.ts src/utils/chunkText.test.ts`

Expected: PASS.

Commit:

```bash
git add src/services/rag.service.ts
git commit -m "implement rag service"
```

---

### Task 5: Add RAG Routes

**Files:**
- Create: `src/routes/rag.route.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/worker.test.ts`

- [ ] **Step 1: Create route module**

Create `src/routes/rag.route.ts`:

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { ApiResponse } from '../core/response'
import { RagService } from '../services/rag.service'

const createDocumentSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题太长啦'),
  content: z.string().trim().min(1, '文档内容不能为空'),
})

const querySchema = z.object({
  question: z.string().trim().min(1, '问题不能为空'),
  topK: z.number().int().min(1).max(10).default(5),
})

const ragApp = new Hono()

ragApp.post('/documents', zValidator('json', createDocumentSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.createDocument(data)

  return c.json(ApiResponse.success(result, '文档入库成功', 201), 201)
})

ragApp.post('/query', zValidator('json', querySchema), async (c) => {
  const data = c.req.valid('json')
  const result = await RagService.query(data)

  return c.json(ApiResponse.success(result))
})

export default ragApp
```

- [ ] **Step 2: Mount route**

Modify `src/routes/index.ts` to include:

```ts
import { Hono } from 'hono'
import userApp from './user.route'
import ragApp from './rag.route'

const apiRouter = new Hono()

apiRouter.route('/users', userApp)
apiRouter.route('/rag', ragApp)

export default apiRouter
```

- [ ] **Step 3: Extend import-safety test**

Modify `src/worker.test.ts`:

```ts
import { expect, test } from 'bun:test'

test('worker module imports without DATABASE_URL at module load time', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    const worker = await import('./worker')

    expect(worker.default.fetch).toBeFunction()
  } finally {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  }
})
```

- [ ] **Step 4: Run tests and commit**

Run: `bun test src/worker.test.ts src/utils/chunkText.test.ts`

Expected: PASS.

Commit:

```bash
git add src/routes/rag.route.ts src/routes/index.ts src/worker.test.ts
git commit -m "add rag api routes"
```

---

### Task 6: Document Environment And Verify

**Files:**
- Modify: `.env.example` if the file exists, otherwise modify `README.md`

- [ ] **Step 1: Add environment documentation**

If `.env.example` exists, add:

```env
OPENAI_CHAT_API_KEY=
OPENAI_CHAT_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=

OPENAI_EMBEDDING_API_KEY=
OPENAI_EMBEDDING_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=120
```

If `.env.example` does not exist, add the same block to `README.md` under a `RAG Environment` heading.

- [ ] **Step 2: Run full test suite**

Run: `bun test`

Expected: all tests PASS.

- [ ] **Step 3: Run Prisma generation**

Run: `bun run db:generate`

Expected: Prisma client generation succeeds.

- [ ] **Step 4: Commit documentation**

Commit:

```bash
git add .env.example README.md 2>/dev/null || git add README.md
git commit -m "document rag environment variables"
```

---

## Manual Verification

After implementation, run these with a development database that has pgvector available:

```bash
bun run db:migrate:dev
bun run dev
```

Create a document:

```bash
curl -X POST http://localhost:3000/api/rag/documents \
  -H 'content-type: application/json' \
  -d '{"title":"RAG intro","content":"RAG retrieves relevant chunks, sends them to a language model, and generates an answer grounded in the retrieved context."}'
```

Ask a question:

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H 'content-type: application/json' \
  -d '{"question":"What does RAG do?","topK":3}'
```

Expected: the response contains `success: true`, a grounded `answer`, and at least one `sources` item from the inserted document.

## Self-Review

- Spec coverage: The plan covers JSON ingestion, chunking, independent chat/embedding configs, pgvector storage/search, prompt construction, no-source behavior, route mounting, and tests.
- Placeholder scan: No placeholder paths or vague implementation steps remain.
- Type consistency: `RagService.createDocument`, `RagService.query`, `EmbeddingService.embed`, `LlmService.chat`, and route request/response shapes use consistent names across tasks.
