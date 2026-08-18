-- Executado automaticamente pela imagem supabase/postgres em
-- /docker-entrypoint-initdb.d (volume vazio) e de novo por
-- `scripts/seed-local.ts` e `scripts/seed-e2e.ts` (volume já existente).
--
-- A imagem supabase/postgres traz um schema `auth` antigo (GoTrue legado):
-- `auth.users` tem `email_change_token` e NÃO tem `auth.identities`.
-- Auth/login reais no db-only continuam no projeto remoto (.env). Este stub
-- só deixa `supabase migration up` passar em migrations históricas que
-- atualizam `auth.users` / `auth.identities` (ex.: 20260718024216).

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_change_token_current character varying(255) NOT NULL DEFAULT '';

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_change_token_new character varying(255) NOT NULL DEFAULT '';

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_change_confirm_status smallint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

GRANT ALL ON TABLE auth.users TO postgres;
GRANT ALL ON TABLE auth.identities TO postgres;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    GRANT ALL ON TABLE auth.identities TO dashboard_user;
  END IF;
END $$;
