-- PR4 E6: ledger of one-time card reauthorization links.
-- Generated with db:migrate:new; safe to replay in local environments.

ALTER TYPE public.asaas_account_migration_status ADD VALUE IF NOT EXISTS 'awaiting_due_date';
ALTER TYPE public.asaas_account_migration_status ADD VALUE IF NOT EXISTS 'legacy_removed';
ALTER TYPE public.asaas_account_migration_status ADD VALUE IF NOT EXISTS 'initial_payment_confirmed';

ALTER TABLE public.corretor_studio_asaas_account_migrations
  ADD COLUMN IF NOT EXISTS primary_payment_id text,
  ADD COLUMN IF NOT EXISTS quote_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS quote_hash text,
  ADD COLUMN IF NOT EXISTS legacy_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reauthorization_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reauthorization_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.corretor_studio_asaas_card_reauthorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL UNIQUE REFERENCES public.corretor_studio_asaas_account_migrations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS asaas_card_reauthorizations_expires_at_idx
  ON public.corretor_studio_asaas_card_reauthorizations (expires_at);

ALTER TABLE public.corretor_studio_asaas_card_reauthorizations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.corretor_studio_asaas_card_reauthorizations FROM anon, authenticated;

COMMENT ON TABLE public.corretor_studio_asaas_card_reauthorizations IS
  'Hash-only, one-time links for Asaas card reauthorization during account migration.';

-- Preserve the existing S4 protections and extend them to the frozen quote.
CREATE OR REPLACE FUNCTION public.protect_asaas_account_migration_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'corretor_studio_asaas_account_migrations is append-only';
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

DROP TRIGGER IF EXISTS trg_protect_asaas_account_migration_snapshot
  ON public.corretor_studio_asaas_account_migrations;
CREATE TRIGGER trg_protect_asaas_account_migration_snapshot
  BEFORE UPDATE OR DELETE ON public.corretor_studio_asaas_account_migrations
  FOR EACH ROW EXECUTE FUNCTION public.protect_asaas_account_migration_snapshot();
