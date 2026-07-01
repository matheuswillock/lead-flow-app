-- Email team domain metadata + domain events timeline

ALTER TABLE "public"."email_team_settings"
  ADD COLUMN IF NOT EXISTS "resendDomainRegion" TEXT,
  ADD COLUMN IF NOT EXISTS "resendDomainConnectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resendOpenTracking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resendClickTracking" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_team_domain_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_team_domain_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "corretor_studio_email_team_domain_events_teamId_occurredAt_idx"
  ON "public"."corretor_studio_email_team_domain_events" ("teamId", "occurredAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_team_domain_events_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_team_domain_events"
      ADD CONSTRAINT "corretor_studio_email_team_domain_events_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
