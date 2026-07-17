-- Migration: fix-whatsapp-conversations-unique-index-drift
-- A migracao 20260618223151_whatsapp-module.sql criou os indices unicos
-- do modulo WhatsApp como indices parciais (WHERE "coluna" IS NOT NULL),
-- enquanto prisma/schema.prisma declara os mesmos campos via `@@unique`
-- sem filtro. No Postgres, um indice unico "cheio" ja trata valores NULL
-- como distintos entre si, entao o comportamento de negocio e identico ao
-- indice parcial -- a unica diferenca e o tamanho do indice. Essa
-- divergencia estrutural faz `prisma db push` tentar recriar os indices
-- com o mesmo nome e falhar com "relation already exists", bloqueando
-- `bun run db:migrate:from-prisma` para qualquer nova migration.
-- Recriamos os indices como nao-parciais para alinhar o schema real ao
-- prisma/schema.prisma.

DROP INDEX IF EXISTS "public"."whatsapp_conversations_configId_externalChatId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conversations_configId_externalChatId_key"
  ON "public"."whatsapp_conversations" ("configId", "externalChatId");

DROP INDEX IF EXISTS "public"."whatsapp_messages_teamId_providerMessageId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_providerMessageId_key"
  ON "public"."whatsapp_messages" ("teamId", "providerMessageId");

DROP INDEX IF EXISTS "public"."whatsapp_messages_teamId_providerEventId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_providerEventId_key"
  ON "public"."whatsapp_messages" ("teamId", "providerEventId");

DROP INDEX IF EXISTS "public"."whatsapp_usage_events_teamId_providerMessageId_eventType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_usage_events_teamId_providerMessageId_eventType_key"
  ON "public"."whatsapp_usage_events" ("teamId", "providerMessageId", "eventType");
