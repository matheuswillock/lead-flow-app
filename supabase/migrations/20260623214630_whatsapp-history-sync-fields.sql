-- WhatsApp history sync status + contact avatar URL

DO $$ BEGIN
  CREATE TYPE "public"."WhatsAppHistorySyncStatus" AS ENUM ('IDLE', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."team_whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "historySyncStatus" "public"."WhatsAppHistorySyncStatus" NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS "historySyncStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "historySyncCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "historySyncError" TEXT;

ALTER TABLE "public"."whatsapp_conversations"
  ADD COLUMN IF NOT EXISTS "contactAvatarUrl" TEXT;
