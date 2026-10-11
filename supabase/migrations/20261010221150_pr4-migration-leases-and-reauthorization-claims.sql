-- PR4 hardening: durable execution leases and atomic card claims.

ALTER TABLE public.corretor_studio_asaas_account_migrations
  ADD COLUMN IF NOT EXISTS resume_status public.asaas_account_migration_status,
  ADD COLUMN IF NOT EXISTS failure_step text,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS asaas_account_migrations_lease_idx
  ON public.corretor_studio_asaas_account_migrations (lease_expires_at)
  WHERE lease_owner IS NOT NULL;

ALTER TABLE public.corretor_studio_asaas_card_reauthorizations
  ADD COLUMN IF NOT EXISTS processing_owner text,
  ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS asaas_card_reauthorizations_processing_idx
  ON public.corretor_studio_asaas_card_reauthorizations (processing_expires_at)
  WHERE processing_owner IS NOT NULL;
