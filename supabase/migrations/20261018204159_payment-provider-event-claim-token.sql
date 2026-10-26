-- PAY-PROV-T030: persist the inbox claim that fenced the last webhook mutation.
ALTER TABLE public.payment_provider_attempts
  ADD COLUMN IF NOT EXISTS last_event_claim_token uuid;
