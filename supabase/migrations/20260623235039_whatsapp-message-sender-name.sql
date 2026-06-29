ALTER TABLE "public"."whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "linkPreview" JSONB;
