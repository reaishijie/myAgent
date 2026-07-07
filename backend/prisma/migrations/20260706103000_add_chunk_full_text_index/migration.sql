CREATE INDEX IF NOT EXISTS "knowledge_chunk_content_fts_idx"
  ON "knowledge_chunks"
  USING GIN (to_tsvector('simple', "content"));
