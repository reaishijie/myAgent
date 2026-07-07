CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

CREATE TABLE "knowledge_bases" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "knowledge_documents" ADD COLUMN "knowledge_base_id" INTEGER;

CREATE TABLE "widgets" (
  "id" VARCHAR(32) PRIMARY KEY,
  "knowledge_base_id" INTEGER NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "bot_name" VARCHAR(80) NOT NULL DEFAULT 'AI Assistant',
  "bot_avatar" VARCHAR(255),
  "welcome_message" TEXT,
  "system_prompt" TEXT,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "chat_sessions" (
  "id" VARCHAR(32) PRIMARY KEY,
  "widget_id" VARCHAR(32) NOT NULL,
  "knowledge_base_id" INTEGER NOT NULL,
  "visitor_id" VARCHAR(120),
  "title" VARCHAR(120),
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "chat_messages" (
  "id" SERIAL PRIMARY KEY,
  "session_id" VARCHAR(32) NOT NULL,
  "role" "ChatMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "widgets"
  ADD CONSTRAINT "widgets_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_widget_id_fkey"
  FOREIGN KEY ("widget_id") REFERENCES "widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "knowledge_base_created_idx" ON "knowledge_bases"("created_at");
CREATE INDEX "knowledge_document_knowledge_base_idx" ON "knowledge_documents"("knowledge_base_id");
CREATE INDEX "widget_knowledge_base_idx" ON "widgets"("knowledge_base_id");
CREATE INDEX "widget_enabled_idx" ON "widgets"("is_enabled");
CREATE INDEX "chat_session_widget_created_idx" ON "chat_sessions"("widget_id", "created_at");
CREATE INDEX "chat_session_visitor_idx" ON "chat_sessions"("visitor_id");
CREATE INDEX "chat_message_session_created_idx" ON "chat_messages"("session_id", "created_at");
