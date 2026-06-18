-- Template lifecycle (draft -> published) + per-template declared variables.
-- Only published templates can be used in campaigns (enforced in the use case layer).

ALTER TABLE "public"."corretor_studio_email_templates"
  ADD COLUMN IF NOT EXISTS "variables" jsonb,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "publishedAt" timestamptz;

-- Existing templates were usable before the lifecycle existed; treat already-approved
-- templates as published so current campaigns keep working.
UPDATE "public"."corretor_studio_email_templates"
  SET "status" = 'published', "publishedAt" = COALESCE("publishedAt", "updatedAt")
  WHERE "status" = 'draft' AND "approvalStatus" = 'approved';

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_teamId_status_idx"
  ON "public"."corretor_studio_email_templates" ("teamId", "status");
