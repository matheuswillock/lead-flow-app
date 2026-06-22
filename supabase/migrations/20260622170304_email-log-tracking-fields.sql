-- EmailLog tracking fields + email.failed event type

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_log_category') THEN
    CREATE TYPE "public"."email_log_category" AS ENUM (
      'campaign',
      'meeting_invite',
      'schedule_notification',
      'transactional',
      'other'
    );
  END IF;
END $$;

ALTER TYPE "public"."email_event_type" ADD VALUE IF NOT EXISTS 'failed';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_email_dispatch_event_type') THEN
    ALTER TYPE "public"."backoffice_email_dispatch_event_type" ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END $$;

ALTER TABLE "public"."corretor_studio_email_logs"
  ADD COLUMN IF NOT EXISTS "category" "public"."email_log_category" NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

UPDATE "public"."corretor_studio_email_logs"
SET "category" = 'campaign'
WHERE "campaignId" IS NOT NULL
  AND "category" = 'other';

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_category_sent_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "category", "sentAt" DESC);
