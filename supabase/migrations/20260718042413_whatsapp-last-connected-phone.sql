-- Persist last connected phone across disconnect so we can detect number swaps.
ALTER TABLE "public"."team_whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "lastConnectedNormalizedPhone" text;

-- Backfill from current normalizedPhone when present.
UPDATE "public"."team_whatsapp_configs"
SET "lastConnectedNormalizedPhone" = "normalizedPhone"
WHERE "lastConnectedNormalizedPhone" IS NULL
  AND "normalizedPhone" IS NOT NULL;
