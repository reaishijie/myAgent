-- Add optional document category for filtered retrieval and admin pagination.
ALTER TABLE "knowledge_documents" ADD COLUMN "category" VARCHAR(80);

CREATE INDEX "knowledge_document_kb_category_idx" ON "knowledge_documents"("knowledge_base_id", "category");
