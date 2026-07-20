-- Studio Bot outbox retry / backoff fields

ALTER TABLE "public"."backoffice_bot_event_outbox"
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."backoffice_bot_event_outbox"
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMPTZ(6);

ALTER TABLE "public"."backoffice_bot_event_outbox"
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;

CREATE INDEX IF NOT EXISTS "backoffice_bot_event_outbox_retry_idx"
  ON "public"."backoffice_bot_event_outbox" ("status", "nextAttemptAt", "attemptCount", "createdAt");
