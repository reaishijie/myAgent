ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "file_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "file_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "parse_status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "parse_error" TEXT;

CREATE INDEX IF NOT EXISTS "knowledge_document_file_hash_idx" ON "knowledge_documents"("file_hash");
