-- Landing analytics events. The table stores sanitized, team-scoped events;
-- raw IP addresses and cookies are intentionally excluded.
ALTER TYPE "team_webhook_event_key" ADD VALUE IF NOT EXISTS 'landing_analytics_event';

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_landing_analytics_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL,
  "landingPageId" uuid NOT NULL,
  "publicationId" uuid NOT NULL,
  "formId" uuid,
  "eventId" text NOT NULL,
  "eventType" text NOT NULL,
  "schemaVersion" integer NOT NULL DEFAULT 1,
  "templateSlug" text NOT NULL,
  "visitorSessionId" text NOT NULL,
  "campaignId" uuid,
  "emailLogId" uuid,
  "attribution" jsonb NOT NULL DEFAULT '{}',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "ipHash" text,
  "userAgent" text,
  "referrer" text,
  "occurredAt" timestamptz(6) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT current_timestamp,
  CONSTRAINT "corretor_studio_landing_analytics_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_landing_analytics_events_eventId_key" UNIQUE ("eventId")
);

CREATE INDEX IF NOT EXISTS "landing_analytics_events_team_occurred_idx"
  ON "public"."corretor_studio_landing_analytics_events" ("teamId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "landing_analytics_events_landing_occurred_idx"
  ON "public"."corretor_studio_landing_analytics_events" ("landingPageId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "landing_analytics_events_campaign_occurred_idx"
  ON "public"."corretor_studio_landing_analytics_events" ("campaignId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "landing_analytics_events_publication_type_occurred_idx"
  ON "public"."corretor_studio_landing_analytics_events" ("publicationId", "eventType", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "landing_analytics_events_session_occurred_idx"
  ON "public"."corretor_studio_landing_analytics_events" ("visitorSessionId", "occurredAt" DESC);

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_landing_analytics_events"
    ADD CONSTRAINT "landing_analytics_events_team_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_landing_analytics_events"
    ADD CONSTRAINT "landing_analytics_events_landing_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "public"."corretor_studio_landing_pages"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_landing_analytics_events"
    ADD CONSTRAINT "landing_analytics_events_publication_fkey"
    FOREIGN KEY ("publicationId") REFERENCES "public"."corretor_studio_landing_page_publications"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
