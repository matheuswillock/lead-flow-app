CREATE TABLE IF NOT EXISTS public.billing_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles(id) ON DELETE CASCADE,
  "asaasCustomerId" text NOT NULL,
  "asaasAccount" public.asaas_account NOT NULL DEFAULT 'primary',
  "productSlug" text NOT NULL,
  "productId" uuid,
  cycle text NOT NULL,
  "billingType" text,
  amount numeric(12,2),
  "quoteSnapshot" jsonb,
  "quoteHash" text,
  "externalReference" text NOT NULL UNIQUE,
  "tokenHash" text NOT NULL UNIQUE,
  "tokenPreview" text NOT NULL,
  "checkoutId" text,
  "checkoutUrl" text,
  status text NOT NULL DEFAULT 'awaiting_method',
  "expiresAt" timestamptz NOT NULL,
  "paidAt" timestamptz,
  "subscriptionId" text,
  "createdAt" timestamptz NOT NULL DEFAULT current_timestamp,
  "updatedAt" timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS billing_checkout_intents_profile_status_idx
  ON public.billing_checkout_intents ("profileId", status);
CREATE INDEX IF NOT EXISTS billing_checkout_intents_checkout_id_idx
  ON public.billing_checkout_intents ("checkoutId");

ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_checkout_intents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_checkout_intents TO service_role;
DROP POLICY IF EXISTS billing_checkout_intents_service_role_only ON public.billing_checkout_intents;
CREATE POLICY billing_checkout_intents_service_role_only
  ON public.billing_checkout_intents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.backoffice_user_subscriptions
  ADD COLUMN IF NOT EXISTS quote_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS quote_hash text,
  ADD COLUMN IF NOT EXISTS quote_created_at timestamptz;
