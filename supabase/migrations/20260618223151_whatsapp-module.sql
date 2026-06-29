-- Migration: whatsapp-module
-- WhatsApp integration module for Lead Flow
-- Adds TeamWhatsAppConfig, WhatsAppConversation, WhatsAppMessage, WhatsAppUsageEvent

-- Enums
DO $$ BEGIN
  CREATE TYPE "WhatsAppProvider" AS ENUM ('EVOLUTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('PENDING', 'QR_READY', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppUsageEventType" AS ENUM ('OUTBOUND_MESSAGE', 'INBOUND_MESSAGE', 'CONNECTION_EVENT', 'RECONNECTION_EVENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TeamWhatsAppConfig: one config per team
CREATE TABLE IF NOT EXISTS "team_whatsapp_configs" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "teamId"              UUID        NOT NULL,
    "provider"            "WhatsAppProvider"         NOT NULL DEFAULT 'EVOLUTION',
    "instanceName"        TEXT        NOT NULL,
    "instanceId"          TEXT,
    "phoneNumber"         TEXT,
    "displayName"         TEXT,
    "status"              "WhatsAppConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "qrCodeText"          TEXT,
    "qrCodeImageUrl"      TEXT,
    "webhookSecret"       TEXT        NOT NULL,
    "hostBaseUrl"         TEXT,
    "lastConnectedAt"     TIMESTAMPTZ,
    "lastDisconnectedAt"  TIMESTAMPTZ,
    "lastSyncAt"          TIMESTAMPTZ,
    "usageLimitMonthly"   INTEGER     NOT NULL DEFAULT 2000,
    "billingEnabled"      BOOLEAN     NOT NULL DEFAULT true,
    "createdByProfileId"  UUID        NOT NULL,
    "updatedByProfileId"  UUID        NOT NULL,
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "team_whatsapp_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_configs_teamId_key"
    ON "team_whatsapp_configs" ("teamId");

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_configs_webhookSecret_key"
    ON "team_whatsapp_configs" ("webhookSecret");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_whatsapp_configs_teamId_fkey') THEN
    ALTER TABLE "team_whatsapp_configs"
      ADD CONSTRAINT "team_whatsapp_configs_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_whatsapp_configs_createdByProfileId_fkey') THEN
    ALTER TABLE "team_whatsapp_configs"
      ADD CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey"
        FOREIGN KEY ("createdByProfileId") REFERENCES "corretor_studio_profiles" ("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_whatsapp_configs_updatedByProfileId_fkey') THEN
    ALTER TABLE "team_whatsapp_configs"
      ADD CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey"
        FOREIGN KEY ("updatedByProfileId") REFERENCES "corretor_studio_profiles" ("id");
  END IF;
END $$;

-- WhatsAppConversation: per-team chat threads
CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "teamId"             UUID        NOT NULL,
    "configId"           UUID        NOT NULL,
    "leadId"             UUID,
    "externalChatId"     TEXT,
    "contactPhone"       TEXT        NOT NULL,
    "contactName"        TEXT,
    "normalizedPhone"    TEXT        NOT NULL,
    "assignedProfileId"  UUID,
    "lastMessageAt"      TIMESTAMPTZ,
    "lastInboundAt"      TIMESTAMPTZ,
    "lastOutboundAt"     TIMESTAMPTZ,
    "lastMessagePreview" TEXT,
    "unreadCount"        INTEGER     NOT NULL DEFAULT 0,
    "isArchived"         BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- P2 fix: unique conversation per (configId, externalChatId) to prevent webhook race duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conversations_configId_externalChatId_key"
    ON "whatsapp_conversations" ("configId", "externalChatId")
    WHERE "externalChatId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_teamId_lastMessageAt_idx"
    ON "whatsapp_conversations" ("teamId", "lastMessageAt" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_teamId_normalizedPhone_idx"
    ON "whatsapp_conversations" ("teamId", "normalizedPhone");

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_leadId_idx"
    ON "whatsapp_conversations" ("leadId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversations_teamId_fkey') THEN
    ALTER TABLE "whatsapp_conversations"
      ADD CONSTRAINT "whatsapp_conversations_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversations_configId_fkey') THEN
    ALTER TABLE "whatsapp_conversations"
      ADD CONSTRAINT "whatsapp_conversations_configId_fkey"
        FOREIGN KEY ("configId") REFERENCES "team_whatsapp_configs" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversations_leadId_fkey') THEN
    ALTER TABLE "whatsapp_conversations"
      ADD CONSTRAINT "whatsapp_conversations_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "corretor_studio_leads" ("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversations_assignedProfileId_fkey') THEN
    ALTER TABLE "whatsapp_conversations"
      ADD CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey"
        FOREIGN KEY ("assignedProfileId") REFERENCES "corretor_studio_profiles" ("id") ON DELETE SET NULL;
  END IF;
END $$;

-- WhatsAppMessage: persisted messages
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "conversationId"    UUID        NOT NULL,
    "teamId"            UUID        NOT NULL,
    "configId"          UUID        NOT NULL,
    "leadId"            UUID,
    "providerMessageId" TEXT,
    "providerEventId"   TEXT,
    "direction"         "WhatsAppMessageDirection" NOT NULL,
    "messageType"       "WhatsAppMessageType"      NOT NULL DEFAULT 'TEXT',
    "status"            "WhatsAppMessageStatus"    NOT NULL DEFAULT 'PENDING',
    "contentText"       TEXT,
    "mediaUrl"          TEXT,
    "mediaMimeType"     TEXT,
    "caption"           TEXT,
    "sentByProfileId"   UUID,
    "senderPhone"       TEXT,
    "recipientPhone"    TEXT,
    "sentAt"            TIMESTAMPTZ,
    "deliveredAt"       TIMESTAMPTZ,
    "readAt"            TIMESTAMPTZ,
    "failedAt"          TIMESTAMPTZ,
    "rawPayload"        JSONB       NOT NULL DEFAULT '{}',
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- Idempotency: unique per (teamId, providerMessageId) to prevent message duplication
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_providerMessageId_key"
    ON "whatsapp_messages" ("teamId", "providerMessageId")
    WHERE "providerMessageId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_providerEventId_key"
    ON "whatsapp_messages" ("teamId", "providerEventId")
    WHERE "providerEventId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversationId_createdAt_idx"
    ON "whatsapp_messages" ("conversationId", "createdAt" ASC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_conversationId_fkey') THEN
    ALTER TABLE "whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_teamId_fkey') THEN
    ALTER TABLE "whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_configId_fkey') THEN
    ALTER TABLE "whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_configId_fkey"
        FOREIGN KEY ("configId") REFERENCES "team_whatsapp_configs" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_leadId_fkey') THEN
    ALTER TABLE "whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "corretor_studio_leads" ("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_sentByProfileId_fkey') THEN
    ALTER TABLE "whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_sentByProfileId_fkey"
        FOREIGN KEY ("sentByProfileId") REFERENCES "corretor_studio_profiles" ("id") ON DELETE SET NULL;
  END IF;
END $$;

-- WhatsAppUsageEvent: billing & quota tracking
CREATE TABLE IF NOT EXISTS "whatsapp_usage_events" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "teamId"              UUID        NOT NULL,
    "configId"            UUID        NOT NULL,
    "conversationId"      UUID,
    "messageId"           UUID,
    "providerMessageId"   TEXT,
    "periodKey"           TEXT        NOT NULL,
    "provider"            "WhatsAppProvider"         NOT NULL DEFAULT 'EVOLUTION',
    "eventType"           "WhatsAppUsageEventType"   NOT NULL,
    "direction"           "WhatsAppMessageDirection",
    "billable"            BOOLEAN     NOT NULL DEFAULT false,
    "countedTowardsQuota" BOOLEAN     NOT NULL DEFAULT true,
    "quantity"            INTEGER     NOT NULL DEFAULT 1,
    "rawPayload"          JSONB,
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_usage_events_pkey" PRIMARY KEY ("id")
);

-- P2 fix: unique per (teamId, providerMessageId, eventType) prevents duplicate billing from Evolution webhook retries
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_usage_events_teamId_providerMessageId_eventType_key"
    ON "whatsapp_usage_events" ("teamId", "providerMessageId", "eventType")
    WHERE "providerMessageId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "whatsapp_usage_events_teamId_periodKey_idx"
    ON "whatsapp_usage_events" ("teamId", "periodKey");

CREATE INDEX IF NOT EXISTS "whatsapp_usage_events_configId_periodKey_idx"
    ON "whatsapp_usage_events" ("configId", "periodKey");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_usage_events_teamId_fkey') THEN
    ALTER TABLE "whatsapp_usage_events"
      ADD CONSTRAINT "whatsapp_usage_events_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_usage_events_configId_fkey') THEN
    ALTER TABLE "whatsapp_usage_events"
      ADD CONSTRAINT "whatsapp_usage_events_configId_fkey"
        FOREIGN KEY ("configId") REFERENCES "team_whatsapp_configs" ("id") ON DELETE CASCADE;
  END IF;
END $$;
