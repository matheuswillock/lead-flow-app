-- Sub-campanhas: parent/child hierarchy + frozen audience snapshot (até 2000 IDs)

ALTER TABLE "public"."corretor_studio_email_campaigns"
  ADD COLUMN IF NOT EXISTS "parentCampaignId" uuid,
  ADD COLUMN IF NOT EXISTS "subCampaignIndex" integer,
  ADD COLUMN IF NOT EXISTS "audienceContactIds" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'corretor_studio_email_campaigns_parentCampaignId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_campaigns"
      ADD CONSTRAINT "corretor_studio_email_campaigns_parentCampaignId_fkey"
      FOREIGN KEY ("parentCampaignId")
      REFERENCES "public"."corretor_studio_email_campaigns"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_campaigns_parentCampaignId_idx"
  ON "public"."corretor_studio_email_campaigns"("parentCampaignId");
