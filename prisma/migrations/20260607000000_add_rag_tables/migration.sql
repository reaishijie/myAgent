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
  "embedding" vector(1536) NOT NULL,
  "embedding_model" VARCHAR(120) NOT NULL,
  "token_count" INTEGER,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "knowledge_document_created_idx" ON "knowledge_documents"("created_at");
CREATE UNIQUE INDEX "knowledge_chunk_document_index_unique" ON "knowledge_chunks"("document_id", "chunk_index");
CREATE INDEX "knowledge_chunk_document_idx" ON "knowledge_chunks"("document_id");
CREATE INDEX "knowledge_chunk_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
