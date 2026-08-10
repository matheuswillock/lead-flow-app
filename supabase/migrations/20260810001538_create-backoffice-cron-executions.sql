-- Estágio 1 CRON_OBSERVABILITY_SPEC: materializa backoffice_cron_executions + enum
-- Espelha prisma/schema.prisma (BackofficeCronExecution / BackofficeCronStatus)

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_cron_status" AS ENUM ('running', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."backoffice_cron_executions" (
  "id" TEXT NOT NULL,
  "cronKey" TEXT NOT NULL,
  "cronPath" TEXT NOT NULL,
  "status" "public"."backoffice_cron_status" NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(6),
  "durationMs" INTEGER,
  "errorSummary" TEXT,
  "errorDetail" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backoffice_cron_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backoffice_cron_executions_cron_key_status_idx"
  ON "public"."backoffice_cron_executions" ("cronKey", "status");

CREATE INDEX IF NOT EXISTS "backoffice_cron_executions_started_at_idx"
  ON "public"."backoffice_cron_executions" ("startedAt");
