-- Migration: cdp-core-schema
-- Customer Data Platform v1 tables

DO $$ BEGIN
  CREATE TYPE "public"."customer_identity_type" AS ENUM (
    'phone',
    'email',
    'document',
    'lead_id',
    'email_contact_id',
    'portfolio_id',
    'whatsapp_contact_id'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_source_type" AS ENUM (
    'crm_lead',
    'portfolio',
    'email_contact',
    'email_campaign',
    'whatsapp_contact'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_channel" AS ENUM (
    'email',
    'whatsapp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_consent_status" AS ENUM (
    'allowed',
    'blocked',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_consent_reason" AS ENUM (
    'manual',
    'imported',
    'unsubscribe',
    'bounce',
    'complaint',
    'opt_out',
    'missing_identity'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_cdp_profiles" (
  "id"                        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teamId"                    UUID        NOT NULL,
  "normalizedName"            TEXT        NOT NULL,
  "displayName"               TEXT        NOT NULL,
  "normalizedPhone"           TEXT        NOT NULL,
  "displayPhone"              TEXT        NOT NULL,
  "primaryEmail"              TEXT,
  "normalizedPrimaryEmail"    TEXT,
  "primaryDocument"           TEXT,
  "normalizedPrimaryDocument" TEXT,
  "lastSeenAt"                TIMESTAMPTZ,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_cdp_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_cdp_profiles_team_phone_name_key"
  ON "public"."corretor_studio_cdp_profiles" ("teamId", "normalizedPhone", "normalizedName");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_profiles_team_email_idx"
  ON "public"."corretor_studio_cdp_profiles" ("teamId", "normalizedPrimaryEmail");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_profiles_team_document_idx"
  ON "public"."corretor_studio_cdp_profiles" ("teamId", "normalizedPrimaryDocument");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_profiles_team_last_seen_idx"
  ON "public"."corretor_studio_cdp_profiles" ("teamId", "lastSeenAt" DESC NULLS LAST);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_profiles_teamId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_profiles"
      ADD CONSTRAINT "corretor_studio_cdp_profiles_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_cdp_identities" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profileId"       UUID        NOT NULL,
  "teamId"          UUID        NOT NULL,
  "type"            "public"."customer_identity_type" NOT NULL,
  "value"           TEXT,
  "normalizedValue" TEXT        NOT NULL,
  "source"          TEXT        NOT NULL,
  "isPrimary"       BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_cdp_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_cdp_identities_team_type_value_key"
  ON "public"."corretor_studio_cdp_identities" ("teamId", "type", "normalizedValue");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_identities_profile_type_idx"
  ON "public"."corretor_studio_cdp_identities" ("profileId", "type");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_identities_profileId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_identities"
      ADD CONSTRAINT "corretor_studio_cdp_identities_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_cdp_profiles" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_identities_teamId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_identities"
      ADD CONSTRAINT "corretor_studio_cdp_identities_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_cdp_source_links" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profileId"      UUID        NOT NULL,
  "teamId"         UUID        NOT NULL,
  "sourceType"     "public"."customer_source_type" NOT NULL,
  "sourceId"       TEXT        NOT NULL,
  "sourceMetadata" JSONB,
  "firstLinkedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastSyncedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_cdp_source_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_cdp_source_links_team_source_key"
  ON "public"."corretor_studio_cdp_source_links" ("teamId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_source_links_profile_source_idx"
  ON "public"."corretor_studio_cdp_source_links" ("profileId", "sourceType");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_source_links_profileId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_source_links"
      ADD CONSTRAINT "corretor_studio_cdp_source_links_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_cdp_profiles" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_source_links_teamId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_source_links"
      ADD CONSTRAINT "corretor_studio_cdp_source_links_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_cdp_events" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profileId"  UUID        NOT NULL,
  "teamId"     UUID        NOT NULL,
  "eventType"  TEXT        NOT NULL,
  "sourceType" TEXT        NOT NULL,
  "sourceId"   TEXT,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_cdp_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_cdp_events_idempotent_key"
  ON "public"."corretor_studio_cdp_events" ("teamId", "sourceType", "sourceId", "eventType", "occurredAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_events_team_type_occurred_idx"
  ON "public"."corretor_studio_cdp_events" ("teamId", "eventType", "occurredAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_events_profile_occurred_idx"
  ON "public"."corretor_studio_cdp_events" ("profileId", "occurredAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_events_profileId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_events"
      ADD CONSTRAINT "corretor_studio_cdp_events_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_cdp_profiles" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_events_teamId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_events"
      ADD CONSTRAINT "corretor_studio_cdp_events_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_cdp_channel_consents" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profileId"  UUID        NOT NULL,
  "teamId"     UUID        NOT NULL,
  "channel"    "public"."customer_channel" NOT NULL,
  "status"     "public"."customer_consent_status" NOT NULL DEFAULT 'unknown',
  "reason"     "public"."customer_consent_reason",
  "sourceType" TEXT,
  "sourceId"   TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_cdp_channel_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_cdp_channel_consents_profile_channel_key"
  ON "public"."corretor_studio_cdp_channel_consents" ("profileId", "channel");

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_channel_consents_team_channel_status_idx"
  ON "public"."corretor_studio_cdp_channel_consents" ("teamId", "channel", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_channel_consents_profileId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_channel_consents"
      ADD CONSTRAINT "corretor_studio_cdp_channel_consents_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_cdp_profiles" ("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_cdp_channel_consents_teamId_fkey') THEN
    ALTER TABLE "public"."corretor_studio_cdp_channel_consents"
      ADD CONSTRAINT "corretor_studio_cdp_channel_consents_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE;
  END IF;
END $$;
