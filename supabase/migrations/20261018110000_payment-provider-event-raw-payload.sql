-- Preserve the exact authenticated webhook bytes alongside the parsed payload.

ALTER TABLE "payment_provider_event_inbox"
  ADD COLUMN "raw_payload" TEXT NOT NULL DEFAULT '';

ALTER TABLE "payment_provider_event_inbox"
  ALTER COLUMN "raw_payload" DROP DEFAULT;

ALTER TABLE "payment_provider_event_outbox"
  ADD COLUMN "raw_payload" TEXT NOT NULL DEFAULT '';

ALTER TABLE "payment_provider_event_outbox"
  ALTER COLUMN "raw_payload" DROP DEFAULT;
