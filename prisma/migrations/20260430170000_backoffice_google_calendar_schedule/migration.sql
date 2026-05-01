CREATE TYPE "BackofficeInviteDispatchStatus" AS ENUM ('sent_google', 'sent_resend', 'failed');

ALTER TABLE "backoffice_users"
  ADD COLUMN IF NOT EXISTS "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "googleAccessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "googleTokenExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "googleEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE INDEX IF NOT EXISTS "backoffice_users_google_connected_idx"
  ON "backoffice_users" ("googleCalendarConnected");

CREATE TABLE IF NOT EXISTS "backoffice_leads_schedule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "closerBackofficeUserId" UUID,
  "date" TIMESTAMPTZ(6) NOT NULL,
  "meetingTitle" TEXT,
  "notes" TEXT,
  "meetingLink" TEXT,
  "extraGuests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "googleEventId" TEXT,
  "googleCalendarId" TEXT,
  "inviteDispatchStatus" "BackofficeInviteDispatchStatus",
  "inviteDispatchProvider" TEXT,
  "inviteDispatchFallbackUsed" BOOLEAN NOT NULL DEFAULT false,
  "inviteDispatchLastAttemptAt" TIMESTAMPTZ(6),
  "inviteDispatchLastError" TEXT,
  "inviteDispatchLastPayload" JSONB,
  "isCanceled" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMPTZ(6),
  "canceledByProfileId" UUID,
  "cancelReason" TEXT,
  "createdByProfileId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backoffice_leads_schedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backoffice_leads_schedule_lead_id_idx"
  ON "backoffice_leads_schedule" ("leadId");

CREATE INDEX IF NOT EXISTS "backoffice_leads_schedule_closer_user_id_idx"
  ON "backoffice_leads_schedule" ("closerBackofficeUserId");

CREATE INDEX IF NOT EXISTS "backoffice_leads_schedule_date_idx"
  ON "backoffice_leads_schedule" ("date");

CREATE INDEX IF NOT EXISTS "backoffice_leads_schedule_is_canceled_idx"
  ON "backoffice_leads_schedule" ("isCanceled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'backoffice_leads_schedule_leadId_fkey'
  ) THEN
    ALTER TABLE "backoffice_leads_schedule"
      ADD CONSTRAINT "backoffice_leads_schedule_leadId_fkey"
      FOREIGN KEY ("leadId")
      REFERENCES "backoffice_leads"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'backoffice_leads_schedule_closer_backoffice_user_id_fkey'
  ) THEN
    ALTER TABLE "backoffice_leads_schedule"
      ADD CONSTRAINT "backoffice_leads_schedule_closer_backoffice_user_id_fkey"
      FOREIGN KEY ("closerBackofficeUserId")
      REFERENCES "backoffice_users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END$$;
