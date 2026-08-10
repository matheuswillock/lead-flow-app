-- EmailContactRadarSyncOutbox: fila desacoplada de sync Radar pós-import de contatos (D9)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_contact_radar_sync_outbox_status') THEN
    CREATE TYPE "public"."email_contact_radar_sync_outbox_status" AS ENUM (
      'pending',
      'processing',
      'sent',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_contact_radar_sync_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "emailContactId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "emailImportJobId" UUID,
  "status" "public"."email_contact_radar_sync_outbox_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_contact_radar_sync_outbox_emailContactId_key"
  ON "public"."corretor_studio_email_contact_radar_sync_outbox" ("emailContactId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_contact_radar_sync_outbox_status_nextAttemptAt_idx"
  ON "public"."corretor_studio_email_contact_radar_sync_outbox" ("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_contact_radar_sync_outbox_emailImportJobId_status_idx"
  ON "public"."corretor_studio_email_contact_radar_sync_outbox" ("emailImportJobId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailContactId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_radar_sync_outbox"
      ADD CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_emailContactId_fkey"
      FOREIGN KEY ("emailContactId") REFERENCES "public"."corretor_studio_email_contacts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_radar_sync_outbox"
      ADD CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailImportJobId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_radar_sync_outbox"
      ADD CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_emailImportJobId_fkey"
      FOREIGN KEY ("emailImportJobId") REFERENCES "public"."corretor_studio_email_import_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
