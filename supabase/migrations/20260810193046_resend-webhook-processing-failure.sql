-- D11 / Estágio 10: outbox for Resend webhook processing failures (internal retry)

DO $$ BEGIN
  CREATE TYPE "public"."resend_webhook_processing_failure_status" AS ENUM (
    'pending',
    'processing',
    'resolved',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_resend_webhook_processing_failures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "svixId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "public"."resend_webhook_processing_failure_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_resend_webhook_processing_failures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_resend_webhook_processing_failures_svixId_key"
  ON "public"."corretor_studio_resend_webhook_processing_failures" ("svixId");

CREATE INDEX IF NOT EXISTS "corretor_studio_resend_webhook_processing_failures_status_nextAttemptAt_idx"
  ON "public"."corretor_studio_resend_webhook_processing_failures" ("status", "nextAttemptAt");

ALTER TABLE "public"."corretor_studio_resend_webhook_processing_failures" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "deny_all_jwt_resend_webhook_processing_failures"
    ON "public"."corretor_studio_resend_webhook_processing_failures"
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
