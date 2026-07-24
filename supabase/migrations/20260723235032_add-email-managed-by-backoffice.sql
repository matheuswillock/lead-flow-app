-- Add managedByBackofficeUserId to product email entities for Corretor Studio managed badge.

ALTER TABLE "public"."corretor_studio_email_templates"
  ADD COLUMN IF NOT EXISTS "managedByBackofficeUserId" uuid;

ALTER TABLE "public"."corretor_studio_email_contact_lists"
  ADD COLUMN IF NOT EXISTS "managedByBackofficeUserId" uuid;

ALTER TABLE "public"."corretor_studio_email_import_jobs"
  ADD COLUMN IF NOT EXISTS "managedByBackofficeUserId" uuid;

ALTER TABLE "public"."corretor_studio_email_campaigns"
  ADD COLUMN IF NOT EXISTS "managedByBackofficeUserId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_templates_managedByBackofficeUserId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates"
      ADD CONSTRAINT "corretor_studio_email_templates_managedByBackofficeUserId_fkey"
      FOREIGN KEY ("managedByBackofficeUserId") REFERENCES "public"."backoffice_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_contact_lists_managedByBackofficeUserId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_lists"
      ADD CONSTRAINT "corretor_studio_email_contact_lists_managedByBackofficeUserId_fkey"
      FOREIGN KEY ("managedByBackofficeUserId") REFERENCES "public"."backoffice_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_import_jobs_managedByBackofficeUserId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_import_jobs"
      ADD CONSTRAINT "corretor_studio_email_import_jobs_managedByBackofficeUserId_fkey"
      FOREIGN KEY ("managedByBackofficeUserId") REFERENCES "public"."backoffice_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_campaigns_managedByBackofficeUserId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_campaigns"
      ADD CONSTRAINT "corretor_studio_email_campaigns_managedByBackofficeUserId_fkey"
      FOREIGN KEY ("managedByBackofficeUserId") REFERENCES "public"."backoffice_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_managedByBackofficeUserId_idx"
  ON "public"."corretor_studio_email_templates"("managedByBackofficeUserId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_contact_lists_managedByBackofficeUserId_idx"
  ON "public"."corretor_studio_email_contact_lists"("managedByBackofficeUserId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_import_jobs_managedByBackofficeUserId_idx"
  ON "public"."corretor_studio_email_import_jobs"("managedByBackofficeUserId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_campaigns_managedByBackofficeUserId_idx"
  ON "public"."corretor_studio_email_campaigns"("managedByBackofficeUserId");
