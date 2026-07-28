-- Team Webhooks (inbound/outbound) — schema + data migration from Studio Webhook
-- Idempotent where possible.

-- Enums
DO $$ BEGIN
  CREATE TYPE "team_webhook_direction" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "team_webhook_status" AS ENUM ('active', 'paused', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "team_webhook_destination_preset" AS ENUM ('generic', 'slack', 'teams', 'zapier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "team_webhook_event_key" AS ENUM (
    'lead_created',
    'lead_status_changed',
    'lead_assigned',
    'appointment_created',
    'appointment_reminder',
    'activity_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "team_webhook_log_result" AS ENUM ('success', 'failure', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "team_webhook_outbox_status" AS ENUM (
    'pending',
    'processing',
    'delivered',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NotificationType: WEBHOOK_AUTO_PAUSED
DO $$ BEGIN
  ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'WEBHOOK_AUTO_PAUSED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_webhooks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL,
  "direction" "team_webhook_direction" NOT NULL,
  "status" "team_webhook_status" NOT NULL DEFAULT 'active',
  "name" text NOT NULL,
  "targetUrl" text,
  "destinationPreset" "team_webhook_destination_preset",
  "selectedEvents" "team_webhook_event_key"[] NOT NULL DEFAULT ARRAY[]::"team_webhook_event_key"[],
  "failureStreak" integer NOT NULL DEFAULT 0,
  "failureThreshold" integer NOT NULL DEFAULT 10,
  "pausedAt" timestamptz(6),
  "pauseReason" text,
  "tokenHash" text,
  "tokenCipher" text,
  "tokenPreview" text,
  "expiryMode" "studio_webhook_token_expiry_mode",
  "expiresAt" timestamptz(6),
  "lastUsedAt" timestamptz(6),
  "lastSuccessAt" timestamptz(6),
  "lastFailureAt" timestamptz(6),
  "updatedByProfileId" uuid NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_webhook_event_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL,
  "webhookId" uuid NOT NULL,
  "direction" "team_webhook_direction" NOT NULL,
  "result" "team_webhook_log_result" NOT NULL,
  "eventKey" "team_webhook_event_key",
  "method" text,
  "endpoint" text,
  "statusCode" integer,
  "requestPayload" jsonb,
  "responsePayload" jsonb,
  "errorMessage" text,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_webhook_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_webhook_outbox" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL,
  "webhookId" uuid NOT NULL,
  "eventKey" "team_webhook_event_key" NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "team_webhook_outbox_status" NOT NULL DEFAULT 'pending',
  "attemptCount" integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz(6) NOT NULL DEFAULT now(),
  "lastError" text,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_webhook_outbox_pkey" PRIMARY KEY ("id")
);

-- FKs (idempotent)
DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhooks"
    ADD CONSTRAINT "corretor_studio_team_webhooks_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhooks"
    ADD CONSTRAINT "corretor_studio_team_webhooks_updatedByProfileId_fkey"
    FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhook_event_logs"
    ADD CONSTRAINT "corretor_studio_team_webhook_event_logs_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhook_event_logs"
    ADD CONSTRAINT "corretor_studio_team_webhook_event_logs_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "public"."corretor_studio_team_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhook_outbox"
    ADD CONSTRAINT "corretor_studio_team_webhook_outbox_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_webhook_outbox"
    ADD CONSTRAINT "corretor_studio_team_webhook_outbox_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "public"."corretor_studio_team_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhooks_teamId_direction_status_idx"
  ON "public"."corretor_studio_team_webhooks" ("teamId", "direction", "status");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhooks_teamId_direction_createdAt_idx"
  ON "public"."corretor_studio_team_webhooks" ("teamId", "direction", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhooks_updatedByProfileId_idx"
  ON "public"."corretor_studio_team_webhooks" ("updatedByProfileId");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhooks_expiresAt_idx"
  ON "public"."corretor_studio_team_webhooks" ("expiresAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_event_logs_webhookId_createdAt_idx"
  ON "public"."corretor_studio_team_webhook_event_logs" ("webhookId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_event_logs_teamId_createdAt_idx"
  ON "public"."corretor_studio_team_webhook_event_logs" ("teamId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_event_logs_createdAt_idx"
  ON "public"."corretor_studio_team_webhook_event_logs" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_outbox_status_nextAttemptAt_idx"
  ON "public"."corretor_studio_team_webhook_outbox" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_outbox_webhookId_status_idx"
  ON "public"."corretor_studio_team_webhook_outbox" ("webhookId", "status");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_webhook_outbox_teamId_createdAt_idx"
  ON "public"."corretor_studio_team_webhook_outbox" ("teamId", "createdAt" DESC);

-- Data migration: Studio Webhook config → TeamWebhook inbound (one per team, skip if already migrated)
INSERT INTO "public"."corretor_studio_team_webhooks" (
  "id",
  "teamId",
  "direction",
  "status",
  "name",
  "tokenHash",
  "tokenCipher",
  "tokenPreview",
  "expiryMode",
  "expiresAt",
  "lastUsedAt",
  "updatedByProfileId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  c."teamId",
  'inbound'::"team_webhook_direction",
  CASE
    WHEN c."expiresAt" IS NOT NULL AND c."expiresAt" <= now() THEN 'disabled'::"team_webhook_status"
    ELSE 'active'::"team_webhook_status"
  END,
  'Webhook Genérico de Leads',
  c."tokenHash",
  c."tokenCipher",
  c."tokenPreview",
  c."expiryMode",
  c."expiresAt",
  c."lastUsedAt",
  c."updatedByProfileId",
  c."createdAt",
  c."updatedAt"
FROM "public"."corretor_studio_team_studio_webhook_configs" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."corretor_studio_team_webhooks" w
  WHERE w."teamId" = c."teamId"
    AND w."direction" = 'inbound'
    AND w."name" = 'Webhook Genérico de Leads'
);
