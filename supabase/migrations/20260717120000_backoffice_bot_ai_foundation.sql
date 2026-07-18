-- Bethânia AI v2: private, auditable, opt-in execution records.
-- These tables are written only by the application service role.  RLS plus
-- explicit revokes prevent the Data API from exposing prompts or proposals.

CREATE TABLE "backoffice_bot_ai_configurations" (
  "id" BOOLEAN PRIMARY KEY DEFAULT true CHECK ("id"),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "shadowMode" BOOLEAN NOT NULL DEFAULT true,
  "rolloutPercentage" SMALLINT NOT NULL DEFAULT 0 CHECK ("rolloutPercentage" BETWEEN 0 AND 100),
  "dailyUserLimit" INTEGER NOT NULL DEFAULT 30 CHECK ("dailyUserLimit" > 0),
  "dailyGlobalLimit" INTEGER NOT NULL DEFAULT 1000 CHECK ("dailyGlobalLimit" > 0),
  "timeoutMs" INTEGER NOT NULL DEFAULT 8000 CHECK ("timeoutMs" BETWEEN 1000 AND 8000),
  "circuitBreakerFailureThreshold" INTEGER NOT NULL DEFAULT 5 CHECK ("circuitBreakerFailureThreshold" BETWEEN 1 AND 100),
  "circuitBreakerResetSeconds" INTEGER NOT NULL DEFAULT 60 CHECK ("circuitBreakerResetSeconds" BETWEEN 10 AND 3600),
  "primaryModel" TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  "fallbackModel" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

INSERT INTO "backoffice_bot_ai_configurations" ("id") VALUES (true)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "backoffice_bot_ai_interactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userLinkId" UUID REFERENCES "backoffice_bot_user_links"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "flowId" TEXT,
  "promptVersion" TEXT NOT NULL,
  "intent" TEXT,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('shadow', 'live')),
  "outcome" TEXT NOT NULL CHECK ("outcome" IN ('completed', 'fallback', 'rejected', 'failed')),
  "model" TEXT,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "backoffice_bot_ai_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interactionId" UUID NOT NULL REFERENCES "backoffice_bot_ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "attemptNumber" SMALLINT NOT NULL,
  "outcome" TEXT NOT NULL CHECK ("outcome" IN ('success', 'timeout', 'rate_limited', 'invalid_json', 'provider_error', 'circuit_open')),
  "latencyMs" INTEGER,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("interactionId", "attemptNumber")
);

CREATE TABLE "backoffice_bot_ai_proposals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userLinkId" UUID NOT NULL REFERENCES "backoffice_bot_user_links"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "teamId" UUID NOT NULL REFERENCES "corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "interactionId" UUID REFERENCES "backoffice_bot_ai_interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('note', 'task', 'meeting', 'meeting_cancel', 'attachment')),
  "parametersCipher" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" UUID,
  "assigneeProfileId" UUID REFERENCES "corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'expired', 'rejected', 'failed')),
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "confirmedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "backoffice_bot_ai_feedback" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interactionId" UUID NOT NULL REFERENCES "backoffice_bot_ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userLinkId" UUID REFERENCES "backoffice_bot_user_links"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "value" TEXT NOT NULL CHECK ("value" IN ('helpful', 'not_helpful')),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("interactionId", "userLinkId")
);

CREATE TABLE "backoffice_bot_ai_daily_usage" (
  "date" DATE NOT NULL,
  "userLinkId" UUID REFERENCES "backoffice_bot_user_links"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK ("requests" >= 0),
  "failures" INTEGER NOT NULL DEFAULT 0 CHECK ("failures" >= 0),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("date", "userLinkId")
);

CREATE INDEX "backoffice_bot_ai_interactions_createdAt_idx" ON "backoffice_bot_ai_interactions" ("createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_interactions_userLinkId_createdAt_idx" ON "backoffice_bot_ai_interactions" ("userLinkId", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_attempts_outcome_createdAt_idx" ON "backoffice_bot_ai_attempts" ("outcome", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_proposals_pending_expiresAt_idx" ON "backoffice_bot_ai_proposals" ("expiresAt") WHERE "status" = 'pending';

ALTER TABLE "backoffice_bot_ai_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backoffice_bot_ai_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backoffice_bot_ai_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backoffice_bot_ai_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backoffice_bot_ai_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backoffice_bot_ai_daily_usage" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "backoffice_bot_ai_configurations", "backoffice_bot_ai_interactions", "backoffice_bot_ai_attempts", "backoffice_bot_ai_proposals", "backoffice_bot_ai_feedback", "backoffice_bot_ai_daily_usage" FROM anon, authenticated;
GRANT ALL ON TABLE "backoffice_bot_ai_configurations", "backoffice_bot_ai_interactions", "backoffice_bot_ai_attempts", "backoffice_bot_ai_proposals", "backoffice_bot_ai_feedback", "backoffice_bot_ai_daily_usage" TO service_role;
