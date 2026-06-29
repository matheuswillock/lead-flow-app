-- Migration: whatsapp-contacts-directory
-- Team-level WhatsApp contact directory for LID/JID resolution and mentions

DO $$ BEGIN
  CREATE TYPE "TeamWhatsAppContactSource" AS ENUM ('PHONE_CONTACTS', 'GROUP_PARTICIPANT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "team_whatsapp_contacts" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "teamId"       UUID        NOT NULL,
    "remoteJid"    TEXT        NOT NULL,
    "opaqueId"     TEXT        NOT NULL,
    "phoneNumber"  TEXT,
    "displayName"  TEXT,
    "pushName"     TEXT,
    "source"       "TeamWhatsAppContactSource" NOT NULL,
    "lastSyncedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "team_whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_contacts_teamId_remoteJid_key"
    ON "team_whatsapp_contacts" ("teamId", "remoteJid");

CREATE INDEX IF NOT EXISTS "team_whatsapp_contacts_teamId_opaqueId_idx"
    ON "team_whatsapp_contacts" ("teamId", "opaqueId");

DO $$ BEGIN
  ALTER TABLE "team_whatsapp_contacts"
      ADD CONSTRAINT "team_whatsapp_contacts_teamId_fkey"
          FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
