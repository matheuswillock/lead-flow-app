-- WhatsApp RBAC: conversation creator + shared number policy

ALTER TABLE "public"."whatsapp_conversations"
  ADD COLUMN IF NOT EXISTS "createdByProfileId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversations_createdByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations"
      ADD CONSTRAINT "whatsapp_conversations_createdByProfileId_fkey"
      FOREIGN KEY ("createdByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_createdByProfileId_idx"
  ON "public"."whatsapp_conversations"("createdByProfileId");

ALTER TABLE "public"."team_whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryConfigId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_whatsapp_configs_primaryConfigId_fkey'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs"
      ADD CONSTRAINT "team_whatsapp_configs_primaryConfigId_fkey"
      FOREIGN KEY ("primaryConfigId") REFERENCES "public"."team_whatsapp_configs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_normalizedPhone_idx"
  ON "public"."team_whatsapp_configs"("normalizedPhone");

CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_primaryConfigId_idx"
  ON "public"."team_whatsapp_configs"("primaryConfigId");

-- Backfill normalizedPhone from phoneNumber where possible
UPDATE "public"."team_whatsapp_configs"
SET "normalizedPhone" = regexp_replace("phoneNumber", '[^0-9]', '', 'g')
WHERE "phoneNumber" IS NOT NULL
  AND "normalizedPhone" IS NULL
  AND regexp_replace("phoneNumber", '[^0-9]', '', 'g') <> '';
