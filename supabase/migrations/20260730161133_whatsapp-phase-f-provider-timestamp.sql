-- F-01: Adiciona providerTimestamp a whatsapp_messages
-- Armazena o messageTimestamp real do WhatsApp (Unix epoch em segundos)
-- para ordenação cronológica correta independente da ordem de ingestão.

ALTER TABLE "public"."whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "providerTimestamp" BIGINT;

-- Substituir índice antigo (só createdAt) por índice composto com providerTimestamp
DROP INDEX IF EXISTS "whatsapp_messages_conversationId_createdAt_idx";

CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversationId_providerTimestamp_createdAt_idx"
  ON "public"."whatsapp_messages" ("conversationId", "providerTimestamp" ASC NULLS LAST, "createdAt" ASC);
