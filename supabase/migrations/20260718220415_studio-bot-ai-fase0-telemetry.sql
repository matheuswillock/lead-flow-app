-- Bethânia AI Fase 0 — alinha telemetria ao contrato v2 (SPEC).
-- Tabelas foundation ainda sem tráfego de usuário; recria com campos de tokens/custo/hashes.

DROP TABLE IF EXISTS "public"."backoffice_bot_ai_feedback" CASCADE;
DROP TABLE IF EXISTS "public"."backoffice_bot_ai_proposals" CASCADE;
DROP TABLE IF EXISTS "public"."backoffice_bot_ai_attempts" CASCADE;
DROP TABLE IF EXISTS "public"."backoffice_bot_ai_interactions" CASCADE;
DROP TABLE IF EXISTS "public"."backoffice_bot_ai_daily_usage" CASCADE;
DROP TABLE IF EXISTS "public"."backoffice_bot_ai_configurations" CASCADE;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_provider" AS ENUM ('groq', 'ollama');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_capability" AS ENUM (
    'intent_classification', 'response_composition', 'clarification', 'knowledge_answer',
    'transcription', 'summarization', 'evaluation', 'embedding', 'provider_test'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_interaction_status" AS ENUM (
    'shadowed', 'resolved', 'clarification_needed', 'proposal_created', 'confirmed',
    'executed', 'cancelled', 'rejected', 'fallback', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_attempt_status" AS ENUM (
    'success', 'validation_error', 'rate_limited', 'timeout', 'provider_error', 'circuit_open', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_action_proposal_status" AS ENUM (
    'pending', 'confirmed', 'executed', 'cancelled', 'expired', 'rejected', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_ai_feedback_type" AS ENUM (
    'helpful', 'unhelpful', 'corrected', 'confirmed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "public"."backoffice_bot_ai_configurations" (
  "id" BOOLEAN PRIMARY KEY DEFAULT true CHECK ("id"),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "shadowMode" BOOLEAN NOT NULL DEFAULT true,
  "rolloutPercentage" SMALLINT NOT NULL DEFAULT 0 CHECK ("rolloutPercentage" BETWEEN 0 AND 100),
  "primaryProvider" "public"."backoffice_bot_ai_provider" NOT NULL DEFAULT 'groq',
  "primaryModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b',
  "fallbackModel" TEXT DEFAULT 'llama-3.1-8b-instant',
  "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.78,
  "dailyUserLimit" INTEGER NOT NULL DEFAULT 60 CHECK ("dailyUserLimit" > 0),
  "dailyGlobalLimit" INTEGER NOT NULL DEFAULT 900 CHECK ("dailyGlobalLimit" > 0),
  "timeoutMs" INTEGER NOT NULL DEFAULT 8000 CHECK ("timeoutMs" BETWEEN 1000 AND 30000),
  "circuitBreakerFailureThreshold" INTEGER NOT NULL DEFAULT 5 CHECK ("circuitBreakerFailureThreshold" BETWEEN 1 AND 100),
  "circuitBreakerResetSeconds" INTEGER NOT NULL DEFAULT 60 CHECK ("circuitBreakerResetSeconds" BETWEEN 10 AND 3600),
  "retentionDays" INTEGER NOT NULL DEFAULT 365 CHECK ("retentionDays" BETWEEN 30 AND 730),
  "updatedByProfileId" UUID REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

INSERT INTO "public"."backoffice_bot_ai_configurations" ("id") VALUES (true)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "public"."backoffice_bot_ai_interactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "inboundMessageId" UUID UNIQUE REFERENCES "public"."backoffice_bot_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "userLinkId" UUID REFERENCES "public"."backoffice_bot_user_links"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "profileId" UUID REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sessionId" UUID,
  "teamIdSnapshot" UUID,
  "capability" "public"."backoffice_bot_ai_capability" NOT NULL DEFAULT 'intent_classification',
  "status" "public"."backoffice_bot_ai_interaction_status" NOT NULL DEFAULT 'shadowed',
  "intent" TEXT,
  "confidence" DOUBLE PRECISION,
  "promptKey" TEXT,
  "promptVersion" TEXT NOT NULL DEFAULT 'v0',
  "isShadow" BOOLEAN NOT NULL DEFAULT true,
  "usedFallback" BOOLEAN NOT NULL DEFAULT false,
  "inputHash" TEXT,
  "outputHash" TEXT,
  "errorCode" TEXT,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "public"."backoffice_bot_ai_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interactionId" UUID NOT NULL REFERENCES "public"."backoffice_bot_ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" SMALLINT NOT NULL,
  "provider" "public"."backoffice_bot_ai_provider" NOT NULL,
  "model" TEXT NOT NULL,
  "capability" "public"."backoffice_bot_ai_capability" NOT NULL DEFAULT 'intent_classification',
  "status" "public"."backoffice_bot_ai_attempt_status" NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCostUsd" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "httpStatus" INTEGER,
  "errorCode" TEXT,
  "providerRequestId" TEXT,
  "requestSchemaVersion" TEXT,
  "responseSchemaVersion" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("interactionId", "sequence")
);

CREATE TABLE "public"."backoffice_bot_ai_proposals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userLinkId" UUID NOT NULL REFERENCES "public"."backoffice_bot_user_links"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "profileId" UUID REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "interactionId" UUID REFERENCES "public"."backoffice_bot_ai_interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "teamIdSnapshot" UUID,
  "action" TEXT NOT NULL,
  "paramsSummary" TEXT NOT NULL DEFAULT '',
  "paramsCiphertext" TEXT NOT NULL,
  "encryptionKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "confirmationMessage" TEXT,
  "status" "public"."backoffice_bot_ai_action_proposal_status" NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "confirmedAt" TIMESTAMPTZ(6),
  "executedAt" TIMESTAMPTZ(6),
  "resultCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "public"."backoffice_bot_ai_feedback" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interactionId" UUID NOT NULL REFERENCES "public"."backoffice_bot_ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userLinkId" UUID REFERENCES "public"."backoffice_bot_user_links"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "type" "public"."backoffice_bot_ai_feedback_type" NOT NULL,
  "correctedIntent" TEXT,
  "origin" TEXT NOT NULL DEFAULT 'whatsapp',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "public"."backoffice_bot_ai_daily_usage" (
  "day" DATE NOT NULL,
  "provider" "public"."backoffice_bot_ai_provider" NOT NULL,
  "model" TEXT NOT NULL,
  "capability" "public"."backoffice_bot_ai_capability" NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK ("requests" >= 0),
  "successes" INTEGER NOT NULL DEFAULT 0 CHECK ("successes" >= 0),
  "failures" INTEGER NOT NULL DEFAULT 0 CHECK ("failures" >= 0),
  "fallbacks" INTEGER NOT NULL DEFAULT 0 CHECK ("fallbacks" >= 0),
  "inputTokens" BIGINT NOT NULL DEFAULT 0,
  "outputTokens" BIGINT NOT NULL DEFAULT 0,
  "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
  "latencyP50Ms" INTEGER,
  "latencyP95Ms" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("day", "provider", "model", "capability")
);

CREATE INDEX "backoffice_bot_ai_interactions_createdAt_idx"
  ON "public"."backoffice_bot_ai_interactions" ("createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_interactions_userLinkId_createdAt_idx"
  ON "public"."backoffice_bot_ai_interactions" ("userLinkId", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_interactions_status_createdAt_idx"
  ON "public"."backoffice_bot_ai_interactions" ("status", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_attempts_status_createdAt_idx"
  ON "public"."backoffice_bot_ai_attempts" ("status", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_attempts_provider_model_createdAt_idx"
  ON "public"."backoffice_bot_ai_attempts" ("provider", "model", "createdAt" DESC);
CREATE INDEX "backoffice_bot_ai_proposals_pending_expiresAt_idx"
  ON "public"."backoffice_bot_ai_proposals" ("expiresAt") WHERE "status" = 'pending';

ALTER TABLE "public"."backoffice_bot_ai_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_bot_ai_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_bot_ai_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_bot_ai_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_bot_ai_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_bot_ai_daily_usage" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "public"."backoffice_bot_ai_configurations",
  "public"."backoffice_bot_ai_interactions",
  "public"."backoffice_bot_ai_attempts",
  "public"."backoffice_bot_ai_proposals",
  "public"."backoffice_bot_ai_feedback",
  "public"."backoffice_bot_ai_daily_usage"
FROM anon, authenticated;

GRANT ALL ON TABLE
  "public"."backoffice_bot_ai_configurations",
  "public"."backoffice_bot_ai_interactions",
  "public"."backoffice_bot_ai_attempts",
  "public"."backoffice_bot_ai_proposals",
  "public"."backoffice_bot_ai_feedback",
  "public"."backoffice_bot_ai_daily_usage"
TO service_role;
