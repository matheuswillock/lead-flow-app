DO $$
BEGIN
  CREATE TYPE "public"."asaas_webhook_event_status" AS ENUM (
    'pending',
    'processing',
    'processed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT,
  "payload" JSONB NOT NULL,
  "status" "public"."asaas_webhook_event_status" NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ(6),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asaas_webhook_events_status_received_at_idx"
  ON "public"."asaas_webhook_events" ("status", "receivedAt" DESC);
