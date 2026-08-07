-- Add SegmentSourceType enum (D14: hierarchical segment generation)
-- Column names follow existing camelCase convention on corretor_studio_radar_segments.

DO $$ BEGIN
  CREATE TYPE "public"."segment_source_type" AS ENUM ('manual', 'campaign', 'child');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."corretor_studio_radar_segments"
  ADD COLUMN IF NOT EXISTS "parentId" UUID,
  ADD COLUMN IF NOT EXISTS "sourceType" "public"."segment_source_type" NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourceCampaignId" UUID;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_radar_segments"
    ADD CONSTRAINT "corretor_studio_radar_segments_parentId_fkey"
    FOREIGN KEY ("parentId")
    REFERENCES "public"."corretor_studio_radar_segments"("id")
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_radar_segments"
    ADD CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey"
    FOREIGN KEY ("sourceCampaignId")
    REFERENCES "public"."corretor_studio_email_campaigns"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_segments_parentId_idx"
  ON "public"."corretor_studio_radar_segments"("parentId");

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_segments_sourceCampaignId_idx"
  ON "public"."corretor_studio_radar_segments"("sourceCampaignId");
