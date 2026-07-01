-- Studio Bot (Bethânia) — foundation tables and enums

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_channel_type" AS ENUM ('whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_channel_status" AS ENUM ('pending', 'connected', 'disconnected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_auth_challenge_source" AS ENUM ('channel_email', 'web_otp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_auth_challenge_status" AS ENUM ('pending', 'verified', 'expired', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_user_link_source" AS ENUM ('channel_email', 'web_otp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_message_direction" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_event_outbox_status" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'studio_bot';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'BETHANIA_AUTH_CODE';

CREATE TABLE IF NOT EXISTS "backoffice_bot_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "displayName" TEXT NOT NULL DEFAULT 'Bethânia',
  "avatarUrl" TEXT,
  "avatarStoragePath" TEXT,
  "aboutText" TEXT,
  "phoneNumber" TEXT,
  "lastProfileSyncAt" TIMESTAMPTZ(6),
  "channelType" "backoffice_bot_channel_type" NOT NULL DEFAULT 'whatsapp',
  "status" "backoffice_bot_channel_status" NOT NULL DEFAULT 'pending',
  "providerConfig" JSONB,
  "webhookSecret" TEXT NOT NULL,
  "n8nInboundUrl" TEXT,
  "n8nOutboundSecret" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_auth_challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source" "backoffice_bot_auth_challenge_source" NOT NULL,
  "normalizedPhone" TEXT,
  "emailRequested" TEXT,
  "profileId" UUID,
  "codeHash" TEXT NOT NULL,
  "status" "backoffice_bot_auth_challenge_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "verifiedAt" TIMESTAMPTZ(6),
  "ipMetadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_user_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "linkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "linkedBy" "backoffice_bot_user_link_source" NOT NULL,
  "authChallengeId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastInteractionAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_user_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userLinkId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "currentLeadId" UUID,
  "flowId" TEXT,
  "flowStep" TEXT,
  "flowStack" JSONB NOT NULL DEFAULT '[]',
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL,
  "userLinkId" UUID,
  "direction" "backoffice_bot_message_direction" NOT NULL,
  "channelMessageId" TEXT,
  "flowId" TEXT,
  "errorCode" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_notification_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHours" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_event_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "profileId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "backoffice_bot_event_outbox_status" NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "sentAt" TIMESTAMPTZ(6),
  CONSTRAINT "backoffice_bot_event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_bot_messages_channelMessageId_key"
  ON "backoffice_bot_messages"("channelMessageId");

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_bot_user_links_authChallengeId_key"
  ON "backoffice_bot_user_links"("authChallengeId");

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_bot_notification_preferences_profileId_type_key"
  ON "backoffice_bot_notification_preferences"("profileId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_bot_event_outbox_idempotencyKey_key"
  ON "backoffice_bot_event_outbox"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "backoffice_bot_auth_challenges_normalizedPhone_status_idx"
  ON "backoffice_bot_auth_challenges"("normalizedPhone", "status");

CREATE INDEX IF NOT EXISTS "backoffice_bot_auth_challenges_profileId_createdAt_idx"
  ON "backoffice_bot_auth_challenges"("profileId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_bot_user_links_profileId_idx"
  ON "backoffice_bot_user_links"("profileId");

CREATE INDEX IF NOT EXISTS "backoffice_bot_user_links_normalizedPhone_isActive_idx"
  ON "backoffice_bot_user_links"("normalizedPhone", "isActive");

CREATE INDEX IF NOT EXISTS "backoffice_bot_sessions_userLinkId_expiresAt_idx"
  ON "backoffice_bot_sessions"("userLinkId", "expiresAt");

CREATE INDEX IF NOT EXISTS "backoffice_bot_messages_userLinkId_createdAt_idx"
  ON "backoffice_bot_messages"("userLinkId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_bot_messages_channelId_createdAt_idx"
  ON "backoffice_bot_messages"("channelId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_bot_event_outbox_status_createdAt_idx"
  ON "backoffice_bot_event_outbox"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "backoffice_bot_event_outbox_profileId_createdAt_idx"
  ON "backoffice_bot_event_outbox"("profileId", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_auth_challenges"
    ADD CONSTRAINT "backoffice_bot_auth_challenges_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_user_links"
    ADD CONSTRAINT "backoffice_bot_user_links_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_user_links"
    ADD CONSTRAINT "backoffice_bot_user_links_authChallengeId_fkey"
    FOREIGN KEY ("authChallengeId") REFERENCES "backoffice_bot_auth_challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_sessions"
    ADD CONSTRAINT "backoffice_bot_sessions_userLinkId_fkey"
    FOREIGN KEY ("userLinkId") REFERENCES "backoffice_bot_user_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_sessions"
    ADD CONSTRAINT "backoffice_bot_sessions_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_messages"
    ADD CONSTRAINT "backoffice_bot_messages_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "backoffice_bot_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_messages"
    ADD CONSTRAINT "backoffice_bot_messages_userLinkId_fkey"
    FOREIGN KEY ("userLinkId") REFERENCES "backoffice_bot_user_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_notification_preferences"
    ADD CONSTRAINT "backoffice_bot_notification_preferences_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_event_outbox"
    ADD CONSTRAINT "backoffice_bot_event_outbox_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
