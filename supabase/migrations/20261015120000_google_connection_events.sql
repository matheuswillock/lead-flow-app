CREATE TYPE "GoogleConnectionEventType" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');
CREATE TYPE "GoogleConnectionFlow" AS ENUM ('LOGIN', 'ACCOUNT', 'BACKOFFICE');
CREATE TABLE "google_connection_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventType" "GoogleConnectionEventType" NOT NULL, "flow" "GoogleConnectionFlow" NOT NULL,
  "profileId" UUID, "supabaseUserId" UUID, "googleEmail" TEXT, "errorCode" TEXT, "errorCategory" TEXT,
  "requestId" TEXT, "dedupeKey" TEXT UNIQUE, "metadata" JSONB,
  CONSTRAINT "google_connection_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_connection_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "google_connection_events_profileId_createdAt_idx" ON "google_connection_events" ("profileId", "createdAt" DESC);
CREATE INDEX "google_connection_events_supabaseUserId_createdAt_idx" ON "google_connection_events" ("supabaseUserId", "createdAt" DESC);
CREATE INDEX "google_connection_events_requestId_idx" ON "google_connection_events" ("requestId");
CREATE INDEX "google_connection_events_createdAt_idx" ON "google_connection_events" ("createdAt" DESC);
ALTER TABLE "google_connection_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "google_connection_events" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "google_connection_events" TO service_role;
CREATE POLICY "google_connection_events_service_role_all" ON "google_connection_events" FOR ALL TO service_role USING (true) WITH CHECK (true);
