-- Email import jobs + notification type + editorMode default

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'EMAIL_IMPORT_COMPLETED'
  ) THEN
    ALTER TYPE "public"."notification_type" ADD VALUE 'EMAIL_IMPORT_COMPLETED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_import_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "importId" TEXT NOT NULL,
  "teamId" UUID NOT NULL,
  "listId" UUID NOT NULL,
  "requestedBy" UUID NOT NULL,
  "sourceFormat" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedBatches" JSONB,
  "batchSize" INTEGER NOT NULL DEFAULT 500,
  "attemptsByBatch" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_import_jobs_importId_key"
  ON "public"."corretor_studio_email_import_jobs" ("importId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_import_jobs_teamId_status_idx"
  ON "public"."corretor_studio_email_import_jobs" ("teamId", "status");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_import_jobs_status_createdAt_idx"
  ON "public"."corretor_studio_email_import_jobs" ("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_import_jobs_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_import_jobs"
      ADD CONSTRAINT "corretor_studio_email_import_jobs_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_import_jobs_listId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_import_jobs"
      ADD CONSTRAINT "corretor_studio_email_import_jobs_listId_fkey"
      FOREIGN KEY ("listId") REFERENCES "public"."corretor_studio_email_contact_lists"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_import_jobs_requestedBy_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_import_jobs"
      ADD CONSTRAINT "corretor_studio_email_import_jobs_requestedBy_fkey"
      FOREIGN KEY ("requestedBy") REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "public"."corretor_studio_email_templates"
  ALTER COLUMN "editorMode" SET DEFAULT 'html';
