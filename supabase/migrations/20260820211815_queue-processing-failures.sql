-- Dead-letter das filas Vercel: consumer persiste e dá ack após deliveryCount >= N.
-- Nomes físicos alinhados a prisma/schema.prisma
-- (enum QueueProcessingFailureStatus @@map("queue_processing_failure_status"),
--  model QueueProcessingFailure @@map("corretor_studio_queue_processing_failures")).

DO $$ BEGIN
  CREATE TYPE "public"."queue_processing_failure_status" AS ENUM (
    'pending',
    'processing',
    'resolved',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_queue_processing_failures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "topic" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "public"."queue_processing_failure_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_queue_processing_failures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_queue_processing_failures_topic_idempotency_key"
  ON "public"."corretor_studio_queue_processing_failures" ("topic", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "corretor_studio_queue_processing_failures_status_nextAttemptAt_idx"
  ON "public"."corretor_studio_queue_processing_failures" ("status", "nextAttemptAt");

ALTER TABLE "public"."corretor_studio_queue_processing_failures" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "deny_all_jwt_queue_processing_failures"
    ON "public"."corretor_studio_queue_processing_failures"
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
