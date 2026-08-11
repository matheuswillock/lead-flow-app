-- D13 follow-up (PR #738 Codex P1): version idempotency key scheme per dispatch.
-- Existing in-flight dispatches keep positional keys; new dispatches use contentHash.

DO $$
BEGIN
  CREATE TYPE "email_campaign_batch_idempotency_scheme" AS ENUM ('positional', 'contentHash');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "corretor_studio_email_campaign_dispatches"
  ADD COLUMN IF NOT EXISTS "batchIdempotencyScheme" "email_campaign_batch_idempotency_scheme" NOT NULL DEFAULT 'positional';
