-- PAY-PROV: persist safe PIX instructions (BR Code) on the attempt so an
-- idempotent startPayment replay can return the same payment data without
-- another provider call.
ALTER TABLE public.payment_provider_attempts
  ADD COLUMN IF NOT EXISTS payment_instructions jsonb;
