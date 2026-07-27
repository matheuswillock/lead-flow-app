-- Origem do backup (cron automático vs disparo manual no backoffice).
DO $$ BEGIN
  CREATE TYPE "public"."backoffice_database_backup_source" AS ENUM ('cron', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."backoffice_database_backups"
  ADD COLUMN IF NOT EXISTS "source" "public"."backoffice_database_backup_source" NOT NULL DEFAULT 'cron',
  ADD COLUMN IF NOT EXISTS "triggeredByProfileId" UUID;

CREATE INDEX IF NOT EXISTS "backoffice_database_backups_source_startedAt_idx"
  ON "public"."backoffice_database_backups"("source", "startedAt" DESC);
