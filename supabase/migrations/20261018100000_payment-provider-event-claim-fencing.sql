-- Fences completion updates so an expired processor cannot mutate a replacement claim.

ALTER TABLE "payment_provider_event_inbox"
  ADD COLUMN "claim_token" UUID NOT NULL DEFAULT gen_random_uuid();
