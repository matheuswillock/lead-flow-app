-- Team schedule settings: duração fixa de reunião por time (5-60, passo 5, padrão 30).
-- Inclui reservas transacionais de slots para impedir dupla marcação.

DO $$ BEGIN
  CREATE TYPE "TeamMeetingSlotReservationSource" AS ENUM ('internal', 'public_form');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamMeetingSlotReservationState" AS ENUM ('reserved', 'consumed', 'released');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "corretor_studio_teams"
  ADD COLUMN IF NOT EXISTS "meeting_duration_minutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "corretor_studio_leads"
  ADD COLUMN IF NOT EXISTS "meeting_duration_minutes" INTEGER;

ALTER TABLE "corretor_studio_leads_schedule"
  ADD COLUMN IF NOT EXISTS "meeting_duration_minutes" INTEGER;

ALTER TABLE "corretor_studio_public_form_submissions"
  ADD COLUMN IF NOT EXISTS "meeting_slot_reservation_id" UUID,
  ADD COLUMN IF NOT EXISTS "scheduled_closer_id" UUID,
  ADD COLUMN IF NOT EXISTS "scheduled_duration_minutes" INTEGER;

-- Backfill: reuniões existentes assumem a duração padrão de 30 minutos.
UPDATE "corretor_studio_leads"
  SET "meeting_duration_minutes" = 30
  WHERE "meetingDate" IS NOT NULL AND "meeting_duration_minutes" IS NULL;

UPDATE "corretor_studio_leads_schedule"
  SET "meeting_duration_minutes" = 30
  WHERE "meeting_duration_minutes" IS NULL;

CREATE TABLE IF NOT EXISTS "corretor_studio_team_meeting_slot_reservations" (
  "id" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "closerId" UUID NOT NULL,
  "leadId" UUID,
  "publicFormSubmissionId" UUID,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "source" "TeamMeetingSlotReservationSource" NOT NULL,
  "state" "TeamMeetingSlotReservationState" NOT NULL DEFAULT 'reserved',
  "googleEventId" TEXT,
  "googleCalendarId" TEXT,
  "recovery_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_recovery_error" TEXT,
  "consumedAt" TIMESTAMPTZ(6),
  "releasedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "corretor_studio_team_meeting_slot_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "corretor_studio_team_meeting_slot_reservations_teamId_close_idx"
  ON "corretor_studio_team_meeting_slot_reservations"("teamId", "closerId", "state", "startsAt");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_meeting_slot_reservations_leadId_idx"
  ON "corretor_studio_team_meeting_slot_reservations"("leadId");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_meeting_slot_reservations_publicFormSu_idx"
  ON "corretor_studio_team_meeting_slot_reservations"("publicFormSubmissionId");
CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_submissions_meeting_slot_reserv_idx"
  ON "corretor_studio_public_form_submissions"("meeting_slot_reservation_id");

DO $$ BEGIN
  ALTER TABLE "corretor_studio_team_meeting_slot_reservations"
    ADD CONSTRAINT "corretor_studio_team_meeting_slot_reservations_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_team_meeting_slot_reservations"
    ADD CONSTRAINT "corretor_studio_team_meeting_slot_reservations_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "corretor_studio_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_team_meeting_slot_reservations"
    ADD CONSTRAINT "corretor_studio_team_meeting_slot_reservations_publicFormS_fkey"
    FOREIGN KEY ("publicFormSubmissionId") REFERENCES "corretor_studio_public_form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Constraints de duração: 5 a 60 minutos, múltiplos de 5.
DO $$ BEGIN
  ALTER TABLE "corretor_studio_teams"
    ADD CONSTRAINT "corretor_studio_teams_meeting_duration_minutes_check"
    CHECK ("meeting_duration_minutes" BETWEEN 5 AND 60 AND ("meeting_duration_minutes" % 5) = 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_leads"
    ADD CONSTRAINT "corretor_studio_leads_meeting_duration_minutes_check"
    CHECK ("meeting_duration_minutes" IS NULL OR ("meeting_duration_minutes" BETWEEN 5 AND 60 AND ("meeting_duration_minutes" % 5) = 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_leads_schedule"
    ADD CONSTRAINT "corretor_studio_leads_schedule_meeting_duration_minutes_check"
    CHECK ("meeting_duration_minutes" IS NULL OR ("meeting_duration_minutes" BETWEEN 5 AND 60 AND ("meeting_duration_minutes" % 5) = 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_public_form_submissions"
    ADD CONSTRAINT "corretor_studio_public_form_submissions_scheduled_duration_check"
    CHECK ("scheduled_duration_minutes" IS NULL OR ("scheduled_duration_minutes" BETWEEN 5 AND 60 AND ("scheduled_duration_minutes" % 5) = 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_team_meeting_slot_reservations"
    ADD CONSTRAINT "corretor_studio_team_meeting_slot_reservations_duration_check"
    CHECK ("durationMinutes" BETWEEN 5 AND 60 AND ("durationMinutes" % 5) = 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "corretor_studio_team_meeting_slot_reservations"
    ADD CONSTRAINT "corretor_studio_team_meeting_slot_reservations_ends_after_starts_check"
    CHECK ("endsAt" > "startsAt");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
