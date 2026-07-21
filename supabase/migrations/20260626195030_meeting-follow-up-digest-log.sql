ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'MEETING_FOLLOW_UP_DIGEST';

CREATE TABLE IF NOT EXISTS "public"."meeting_follow_up_digest_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipientProfileId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "digestDate" DATE NOT NULL,
    "sentAt" TIMESTAMPTZ(6) NOT NULL,
    "leadCount" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_follow_up_digest_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meeting_follow_up_digest_logs_recipient_team_date_idx"
ON "public"."meeting_follow_up_digest_logs"("recipientProfileId", "teamId", "digestDate");

CREATE INDEX IF NOT EXISTS "meeting_follow_up_digest_logs_sent_at_idx"
ON "public"."meeting_follow_up_digest_logs"("sentAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meeting_follow_up_digest_logs_recipientProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."meeting_follow_up_digest_logs"
    ADD CONSTRAINT "meeting_follow_up_digest_logs_recipientProfileId_fkey"
    FOREIGN KEY ("recipientProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meeting_follow_up_digest_logs_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."meeting_follow_up_digest_logs"
    ADD CONSTRAINT "meeting_follow_up_digest_logs_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
