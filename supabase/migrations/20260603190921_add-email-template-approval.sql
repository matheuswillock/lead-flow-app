ALTER TABLE "public"."corretor_studio_email_templates"
  ADD COLUMN IF NOT EXISTS "approvalStatus" text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "approvedBy"     uuid,
  ADD COLUMN IF NOT EXISTS "approvedAt"     timestamptz(6),
  ADD COLUMN IF NOT EXISTS "rejectedBy"     uuid,
  ADD COLUMN IF NOT EXISTS "rejectedAt"     timestamptz(6),
  ADD COLUMN IF NOT EXISTS "reviewNote"     text;

ALTER TABLE "public"."corretor_studio_email_templates"
  DROP CONSTRAINT IF EXISTS "email_template_approvalStatus_check",
  ADD CONSTRAINT "email_template_approvalStatus_check"
    CHECK ("approvalStatus" IN ('pending_approval','approved','rejected'));

ALTER TABLE "public"."corretor_studio_email_templates"
  DROP CONSTRAINT IF EXISTS "email_template_approvedBy_fkey",
  ADD CONSTRAINT "email_template_approvedBy_fkey"
    FOREIGN KEY ("approvedBy") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL NOT VALID;

ALTER TABLE "public"."corretor_studio_email_templates"
  DROP CONSTRAINT IF EXISTS "email_template_rejectedBy_fkey",
  ADD CONSTRAINT "email_template_rejectedBy_fkey"
    FOREIGN KEY ("rejectedBy") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL NOT VALID;

ALTER TABLE "public"."corretor_studio_email_templates"
  VALIDATE CONSTRAINT "email_template_approvedBy_fkey";

ALTER TABLE "public"."corretor_studio_email_templates"
  VALIDATE CONSTRAINT "email_template_rejectedBy_fkey";

CREATE INDEX IF NOT EXISTS "email_templates_approvalStatus_idx"
  ON "public"."corretor_studio_email_templates" ("teamId", "approvalStatus")
  WHERE "isArchived" = false;
