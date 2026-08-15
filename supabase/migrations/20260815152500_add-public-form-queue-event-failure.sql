-- PR2.3: outbox fallback compartilhado para as filas de formulários públicos
-- (métricas + submissão). Só recebe linha após 3 tentativas de publish
-- esgotadas (mesmo padrão de corretor_studio_resend_webhook_processing_failures).

DO $$ BEGIN
  CREATE TYPE "public"."public_form_queue_event_kind" AS ENUM (
    'metric',
    'submission'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."public_form_queue_event_failure_status" AS ENUM (
    'pending',
    'processing',
    'resolved',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_public_form_queue_event_failures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kind" "public"."public_form_queue_event_kind" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "public"."public_form_queue_event_failure_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastError" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_public_form_queue_event_failures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_public_form_queue_event_failures_idempotencyKey_key"
  ON "public"."corretor_studio_public_form_queue_event_failures" ("idempotencyKey");

CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_queue_event_failures_status_nextAttemptAt_idx"
  ON "public"."corretor_studio_public_form_queue_event_failures" ("status", "nextAttemptAt");

ALTER TABLE "public"."corretor_studio_public_form_queue_event_failures" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "deny_all_jwt_public_form_queue_event_failures"
    ON "public"."corretor_studio_public_form_queue_event_failures"
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
