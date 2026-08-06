-- WhatsApp Spec 01: engine OPENWA|META + status INITIALIZING

DO $$ BEGIN
  CREATE TYPE "WhatsAppEngine" AS ENUM ('OPENWA', 'META');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "WhatsAppConnectionStatus" ADD VALUE IF NOT EXISTS 'INITIALIZING';

ALTER TABLE "public"."team_whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "engine" "WhatsAppEngine" NOT NULL DEFAULT 'OPENWA';
