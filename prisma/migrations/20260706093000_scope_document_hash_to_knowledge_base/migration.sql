DROP INDEX IF EXISTS "knowledge_documents_content_hash_key";

CREATE UNIQUE INDEX "knowledge_document_kb_hash_unique" ON "knowledge_documents"("knowledge_base_id", "content_hash");
