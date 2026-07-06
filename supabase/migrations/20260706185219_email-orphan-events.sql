-- email_orphan_events: fila assíncrona para backfill de EmailLog órfãos (fora do webhook)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_orphan_event_status') THEN
    CREATE TYPE "public"."email_orphan_event_status" AS ENUM ('pending', 'processed', 'failed', 'skipped');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."email_orphan_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resendEmailId" TEXT NOT NULL,
  "resendEventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "tagsHint" JSONB,
  "status" "public"."email_orphan_event_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_orphan_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_orphan_events_resendEmailId_key"
  ON "public"."email_orphan_events" ("resendEmailId");

CREATE INDEX IF NOT EXISTS "email_orphan_events_status_createdAt_idx"
  ON "public"."email_orphan_events" ("status", "createdAt");
