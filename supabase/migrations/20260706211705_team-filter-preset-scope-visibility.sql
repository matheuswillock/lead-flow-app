-- Filter preset scope and visibility (Item 4 / V1)
-- Backfill heuristic: Performance presets contain keys preset, sdrId, closerId, or pageSize in queryJson

DO $$ BEGIN
  CREATE TYPE "public"."filter_preset_scope" AS ENUM ('crm', 'performance', 'board', 'carteira');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."filter_preset_visibility" AS ENUM ('private', 'team');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."corretor_studio_team_filter_presets"
  ADD COLUMN IF NOT EXISTS "scope" "public"."filter_preset_scope" NOT NULL DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS "visibility" "public"."filter_preset_visibility" NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS "corretor_studio_team_filter_presets_teamId_scope_visibility_idx"
  ON "public"."corretor_studio_team_filter_presets" ("teamId", "scope", "visibility");

-- Classify existing presets: Performance shape uses preset/sdrId/closerId/pageSize keys
UPDATE "public"."corretor_studio_team_filter_presets"
SET "scope" = 'performance'
WHERE "scope" = 'crm'
  AND (
    "queryJson" ? 'preset'
    OR "queryJson" ? 'sdrId'
    OR "queryJson" ? 'closerId'
    OR "queryJson" ? 'pageSize'
  );
