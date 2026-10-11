ALTER TYPE public.asaas_account_migration_status
  ADD VALUE IF NOT EXISTS 'paused_awaiting_card';

CREATE TABLE IF NOT EXISTS public.corretor_studio_asaas_migration_execution_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL UNIQUE
    REFERENCES public.corretor_studio_asaas_account_migrations(id) ON DELETE RESTRICT,
  approved boolean NOT NULL DEFAULT false,
  approved_by text NOT NULL,
  value_mode text NOT NULL CHECK (value_mode IN ('as-is', 'corrected')),
  inventory_hash text NOT NULL,
  gate_run_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  gate_evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT asaas_migration_execution_manifests_validity_check
    CHECK (valid_until > gate_run_at)
);

CREATE INDEX IF NOT EXISTS asaas_migration_execution_manifests_approved_valid_until_idx
  ON public.corretor_studio_asaas_migration_execution_manifests (approved, valid_until);
