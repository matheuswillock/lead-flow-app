-- Closer busy blocks: períodos de indisponibilidade no calendário do closer

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_closer_busy_blocks" (
  "id" uuid NOT NULL,
  "teamId" uuid NOT NULL,
  "profileId" uuid NOT NULL,
  "startsAt" timestamp(6) with time zone NOT NULL,
  "endsAt" timestamp(6) with time zone NOT NULL,
  "allDay" boolean NOT NULL DEFAULT false,
  "isRecurring" boolean NOT NULL DEFAULT false,
  "weekdays" integer[] DEFAULT ARRAY[]::integer[],
  "recurrenceEndsAt" timestamp(6) with time zone,
  "syncToGoogle" boolean NOT NULL DEFAULT false,
  "googleEventId" text,
  "googleCalendarId" text,
  "reason" text,
  "createdByProfileId" uuid NOT NULL,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "corretor_studio_closer_busy_blocks_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_closer_busy_blocks_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_closer_busy_blocks"
      ADD CONSTRAINT "corretor_studio_closer_busy_blocks_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_closer_busy_blocks_profileId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_closer_busy_blocks"
      ADD CONSTRAINT "corretor_studio_closer_busy_blocks_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_closer_busy_blocks_createdByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_closer_busy_blocks"
      ADD CONSTRAINT "corretor_studio_closer_busy_blocks_createdByProfileId_fkey"
      FOREIGN KEY ("createdByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_closer_busy_blocks_teamId_profileId_startsA_idx"
  ON "public"."corretor_studio_closer_busy_blocks" ("teamId", "profileId", "startsAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_closer_busy_blocks_teamId_startsAt_endsAt_idx"
  ON "public"."corretor_studio_closer_busy_blocks" ("teamId", "startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_closer_busy_blocks_profileId_recurrenceEnds_idx"
  ON "public"."corretor_studio_closer_busy_blocks" ("profileId", "recurrenceEndsAt");
