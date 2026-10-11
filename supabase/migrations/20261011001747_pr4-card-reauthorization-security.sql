CREATE TYPE public.asaas_card_reauthorization_attempt_status AS ENUM (
  'processing',
  'confirmed',
  'declined',
  'unknown'
);

CREATE TABLE public.corretor_studio_asaas_card_reauthorization_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reauthorization_id uuid NOT NULL
    REFERENCES public.corretor_studio_asaas_card_reauthorizations(id) ON DELETE RESTRICT,
  master_profile_id uuid NOT NULL,
  attempt_reference text NOT NULL UNIQUE,
  status public.asaas_card_reauthorization_attempt_status NOT NULL DEFAULT 'processing',
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz
);

CREATE INDEX asaas_card_reauth_attempts_limit_idx
  ON public.corretor_studio_asaas_card_reauthorization_attempts
  (reauthorization_id, status, created_at);

ALTER TABLE public.corretor_studio_asaas_account_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_studio_asaas_card_reauthorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_studio_asaas_card_reauthorization_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.corretor_studio_asaas_account_migrations FROM anon, authenticated;
REVOKE ALL ON public.corretor_studio_asaas_card_reauthorizations FROM anon, authenticated;
REVOKE ALL ON public.corretor_studio_asaas_card_reauthorization_attempts FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.corretor_studio_asaas_account_migrations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.corretor_studio_asaas_card_reauthorizations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.corretor_studio_asaas_card_reauthorization_attempts TO service_role;

DROP POLICY IF EXISTS asaas_card_reauthorization_service_role_only
  ON public.corretor_studio_asaas_card_reauthorizations;
CREATE POLICY asaas_card_reauthorization_service_role_only
  ON public.corretor_studio_asaas_card_reauthorizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS asaas_card_reauthorization_attempt_service_role_only
  ON public.corretor_studio_asaas_card_reauthorization_attempts;
CREATE POLICY asaas_card_reauthorization_attempt_service_role_only
  ON public.corretor_studio_asaas_card_reauthorization_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.protect_asaas_account_migration_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'corretor_studio_asaas_account_migrations is append-only';
  END IF;
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'profile_id is immutable';
  END IF;
  IF NEW.client_name IS DISTINCT FROM OLD.client_name THEN
    RAISE EXCEPTION 'client_name is immutable';
  END IF;
  IF NEW.client_email IS DISTINCT FROM OLD.client_email THEN
    RAISE EXCEPTION 'client_email is immutable';
  END IF;
  IF NEW.legacy_customer_id IS DISTINCT FROM OLD.legacy_customer_id THEN
    RAISE EXCEPTION 'legacy_customer_id is immutable';
  END IF;
  IF OLD.legacy_subscription_id IS NOT NULL AND NEW.legacy_subscription_id IS DISTINCT FROM OLD.legacy_subscription_id THEN
    RAISE EXCEPTION 'legacy_subscription_id is immutable once set';
  END IF;
  IF OLD.billing_type IS NOT NULL AND NEW.billing_type IS DISTINCT FROM OLD.billing_type THEN
    RAISE EXCEPTION 'billing_type is immutable once set';
  END IF;
  IF OLD.cycle IS NOT NULL AND NEW.cycle IS DISTINCT FROM OLD.cycle THEN
    RAISE EXCEPTION 'cycle is immutable once set';
  END IF;
  IF OLD.value IS NOT NULL AND NEW.value IS DISTINCT FROM OLD.value THEN
    RAISE EXCEPTION 'value is immutable once set';
  END IF;
  IF OLD.next_due_date IS NOT NULL AND NEW.next_due_date IS DISTINCT FROM OLD.next_due_date THEN
    RAISE EXCEPTION 'next_due_date is immutable once set';
  END IF;
  IF OLD.quote_snapshot IS NOT NULL AND NEW.quote_snapshot IS DISTINCT FROM OLD.quote_snapshot THEN
    RAISE EXCEPTION 'quote_snapshot is immutable once set';
  END IF;
  IF OLD.quote_hash IS NOT NULL AND NEW.quote_hash IS DISTINCT FROM OLD.quote_hash THEN
    RAISE EXCEPTION 'quote_hash is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;
