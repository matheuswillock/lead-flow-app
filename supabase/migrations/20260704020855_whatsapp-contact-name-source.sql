-- Migration: whatsapp-contact-name-source

DO $$ BEGIN
  CREATE TYPE "WhatsAppContactNameSource" AS ENUM ('MANUAL', 'LEAD', 'PHONE_BOOK', 'PUSH_NAME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."whatsapp_conversations"
  ADD COLUMN IF NOT EXISTS "contactNameSource" "WhatsAppContactNameSource" NOT NULL DEFAULT 'PUSH_NAME';

UPDATE "public"."whatsapp_conversations"
SET "contactNameSource" = 'PUSH_NAME'
WHERE "contactNameSource" IS NULL;
