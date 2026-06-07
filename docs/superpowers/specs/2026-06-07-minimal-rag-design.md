# Minimal RAG MVP Design

## Purpose

Build a minimal RAG API in the existing Bun + Hono + Prisma backend. The first version should teach and demonstrate the full RAG path without adding unrelated production features.

The MVP must support:

1. Writing a text document through a JSON API.
2. Splitting the document into chunks.
3. Creating embeddings for the chunks through an OpenAI-compatible embedding API.
4. Storing chunks and vectors in PostgreSQL with pgvector.
5. Embedding a user question.
6. Retrieving the most similar chunks.
7. Building a prompt with retrieved context.
8. Calling an OpenAI-compatible chat API to produce an answer.
9. Returning the answer and source chunks.

Out of scope for this MVP:

- Authentication and authorization.
- Multiple knowledge bases.
- File upload.
- URL crawling.
- Async jobs or queues.
- LangChain or other RAG frameworks.
- Streaming responses.

## Approach

Use a synchronous minimal implementation.

Document ingestion happens during `POST /api/rag/documents`: create the document, chunk the content, create embeddings, and store all chunks before returning.

Question answering happens during `POST /api/rag/query`: embed the question, run pgvector similarity search, build context, call the chat model, and return the answer.

This keeps the code path short and easy to learn. Large document ingestion can be slow, but that is acceptable for the first practical RAG version.

## API

Add `src/routes/rag.route.ts` and mount it under `/api/rag` from `src/routes/index.ts`.

### Create Document

`POST /api/rag/documents`

Request body:

```json
{
  "title": "RAG intro notes",
  "content": "A long text document..."
}
```

Validation:

- `title`: required string, 1 to 120 characters.
- `content`: required string, minimum 1 meaningful character after trimming.

Response data:

```json
{
  "id": 1,
  "title": "RAG intro notes",
  "chunkCount": 3,
  "embeddingModel": "text-embedding-3-small"
}
```

### Query

`POST /api/rag/query`

Request body:

```json
{
  "question": "What is the core RAG flow?",
  "topK": 5
}
```

Validation:

- `question`: required string, minimum 1 meaningful character after trimming.
- `topK`: optional integer, default `5`, minimum `1`, maximum `10`.

Response data:

```json
{
  "answer": "Based on the knowledge base, the core RAG flow is...",
  "sources": [
    {
      "documentId": 1,
      "title": "RAG intro notes",
      "chunkIndex": 0,
      "content": "Relevant original text..."
    }
  ]
}
```

If no chunks are found, return a normal success response with an empty `sources` array and an answer stating that no relevant content was found in the knowledge base. Do not call the chat model in that case.

## Database Design

Add two tables.

### `knowledge_documents`

Stores the original text document.

Fields:

- `id`: integer primary key.
- `title`: varchar.
- `content`: text.
- `metadata`: JSON, nullable.
- `created_at`: timestamp.
- `updated_at`: timestamp.

### `knowledge_chunks`

Stores chunk text and its embedding vector.

Fields:

- `id`: integer primary key.
- `document_id`: foreign key to `knowledge_documents.id`.
- `chunk_index`: integer.
- `content`: text.
- `embedding`: pgvector vector column.
- `embedding_model`: varchar.
- `token_count`: integer, nullable.
- `created_at`: timestamp.

Indexes:

- Index `knowledge_chunks.document_id` for document lookup.
- Vector index on `knowledge_chunks.embedding` for similarity search when the schema is migrated for pgvector.

Prisma should manage ordinary fields where practical. Because pgvector support is not as natural as normal Prisma scalar fields, vector column creation, vector insert, and similarity search can use Prisma raw SQL through `$executeRaw` and `$queryRaw`.

Similarity search should use cosine distance through pgvector:

```sql
ORDER BY embedding <=> $queryEmbedding
LIMIT $topK
```

## Services And Utilities

Add focused modules instead of putting all logic in route handlers.

### `src/services/rag.service.ts`

Coordinates the two main workflows:

- `createDocument(input)`: create document, chunk text, embed chunks, store chunks.
- `query(input)`: embed question, search chunks, build prompt, call chat model, return answer and sources.

### `src/services/embedding.service.ts`

Calls the OpenAI-compatible embeddings API.

It must read only embedding-specific configuration:

- `OPENAI_EMBEDDING_API_KEY`
- `OPENAI_EMBEDDING_BASE_URL`
- `OPENAI_EMBEDDING_MODEL`

It must not reuse chat configuration.

### `src/services/llm.service.ts`

Calls the OpenAI-compatible chat completions API.

It must read only chat-specific configuration:

- `OPENAI_CHAT_API_KEY`
- `OPENAI_CHAT_BASE_URL`
- `OPENAI_CHAT_MODEL`

It must not reuse embedding configuration.

### `src/utils/chunkText.ts`

Splits text by character length for the MVP.

Default settings:

- `RAG_CHUNK_SIZE`: default `800`.
- `RAG_CHUNK_OVERLAP`: default `120`.

The utility should trim chunks and skip empty chunks. It should reject invalid settings where overlap is greater than or equal to chunk size.

## Configuration

Chat and embedding configuration must be independent because users may use different providers for each part.

Environment variables:

```env
OPENAI_CHAT_API_KEY=
OPENAI_CHAT_BASE_URL=
OPENAI_CHAT_MODEL=

OPENAI_EMBEDDING_API_KEY=
OPENAI_EMBEDDING_BASE_URL=
OPENAI_EMBEDDING_MODEL=

RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=120
```

The services should call OpenAI-compatible endpoints:

- Chat: `POST {OPENAI_CHAT_BASE_URL}/chat/completions`
- Embeddings: `POST {OPENAI_EMBEDDING_BASE_URL}/embeddings`

Each service should normalize trailing slashes in the configured base URL before building endpoint URLs.

## Data Flow

Document ingestion:

```text
HTTP request
-> zod validation
-> create knowledge document
-> chunk text
-> create embeddings for chunks
-> insert chunks and vectors
-> response with document id and chunk count
```

Question answering:

```text
HTTP request
-> zod validation
-> create question embedding
-> pgvector similarity search
-> build context from top chunks
-> call chat completion
-> response with answer and sources
```

Prompt construction should be simple and explicit:

```text
You are a question-answering assistant. Answer using only the provided context. If the context does not contain the answer, say that the knowledge base does not contain relevant information.

Context:
[1] ...
[2] ...

Question: ...
```

## Error Handling

Use the existing `BusinessException` pattern where it fits.

Cases to handle:

- Missing embedding configuration: fail document ingestion and query before calling the embedding API.
- Missing chat configuration: fail query before calling the chat API.
- Empty document content: return 400.
- Empty question: return 400.
- Embedding API failure: return a service error, preferably 502.
- Chat API failure: return a service error, preferably 502.
- No retrieved chunks: return a normal response without calling chat.

## Testing

Tests should avoid real network calls and real model credentials.

Initial test coverage:

- `chunkText` unit tests for normal splitting, overlap, trimming, empty text, and invalid settings.
- Route import-safety test so adding the RAG route does not break app or worker imports.
- Optional service tests using injectable `fetch` or mocked request functions for OpenAI-compatible responses.

Manual verification after implementation:

1. Enable pgvector in the development database.
2. Run Prisma generation and migration/push commands.
3. Start the API with `bun run dev`.
4. Create one document through `POST /api/rag/documents`.
5. Ask one related question through `POST /api/rag/query`.
6. Confirm the answer includes sources from the inserted document.

## Implementation Notes

- Keep route handlers thin; validation and HTTP response shaping stay in routes, RAG behavior stays in services.
- Keep the MVP independent of the existing user model.
- Do not add LangChain in the first version; the goal is to learn the underlying mechanics.
- Use raw SQL only where pgvector requires it. Keep ordinary database access aligned with existing Prisma patterns.
