ALTER TABLE "knowledge_documents" ADD COLUMN "content_hash" VARCHAR(64);

CREATE UNIQUE INDEX "knowledge_documents_content_hash_key" ON "knowledge_documents"("content_hash");
