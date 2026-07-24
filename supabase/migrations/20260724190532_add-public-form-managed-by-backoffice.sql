-- Add managedByBackofficeUserId to product public forms for Corretor Studio managed badge.

ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "managedByBackofficeUserId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_public_forms_managedByBackofficeUserId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_public_forms"
      ADD CONSTRAINT "corretor_studio_public_forms_managedByBackofficeUserId_fkey"
      FOREIGN KEY ("managedByBackofficeUserId") REFERENCES "public"."backoffice_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_public_forms_managedByBackofficeUserId_idx"
  ON "public"."corretor_studio_public_forms"("managedByBackofficeUserId");
