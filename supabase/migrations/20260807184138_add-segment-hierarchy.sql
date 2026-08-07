-- Add SegmentSourceType enum
CREATE TYPE "public"."segment_source_type" AS ENUM ('manual', 'campaign', 'child');

-- Add hierarchy fields to corretor_studio_radar_segments
ALTER TABLE "public"."corretor_studio_radar_segments"
  ADD COLUMN "parent_id" UUID,
  ADD COLUMN "source_type" "public"."segment_source_type" NOT NULL DEFAULT 'manual',
  ADD COLUMN "source_campaign_id" UUID;

-- Add foreign key constraints
ALTER TABLE "public"."corretor_studio_radar_segments"
  ADD CONSTRAINT "corretor_studio_radar_segments_parent_id_fkey"
    FOREIGN KEY ("parent_id")
    REFERENCES "public"."corretor_studio_radar_segments"("id")
    ON DELETE CASCADE;

ALTER TABLE "public"."corretor_studio_radar_segments"
  ADD CONSTRAINT "corretor_studio_radar_segments_source_campaign_id_fkey"
    FOREIGN KEY ("source_campaign_id")
    REFERENCES "public"."corretor_studio_email_campaigns"("id")
    ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "corretor_studio_radar_segments_parent_id_idx"
  ON "public"."corretor_studio_radar_segments"("parent_id");

CREATE INDEX "corretor_studio_radar_segments_source_campaign_id_idx"
  ON "public"."corretor_studio_radar_segments"("source_campaign_id");
