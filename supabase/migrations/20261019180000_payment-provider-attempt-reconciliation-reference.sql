-- PAY-PROV: persist the attempt-unique reference returned by the provider when
-- a payment initiation ends indeterminate. Without it an UNKNOWN attempt
-- without an external id can never be re-associated with a charge created by
-- the provider, and it also blocks further attempts for the same checkout.
ALTER TABLE public.payment_provider_attempts
  ADD COLUMN IF NOT EXISTS reconciliation_reference TEXT;

CREATE INDEX IF NOT EXISTS "payment_provider_attempts_reconciliation_reference_idx"
  ON public.payment_provider_attempts ("reconciliation_reference")
  WHERE "reconciliation_reference" IS NOT NULL;
