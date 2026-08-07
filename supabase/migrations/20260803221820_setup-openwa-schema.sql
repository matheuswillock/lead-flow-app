-- Schema isolado para o OpenWA Gateway (RemoteAuth / metadados).
-- Role openwa_app: acesso somente ao schema openwa (sem public/auth).
-- Senha real é definida no provisionamento da VPS / secrets — placeholder rotacionável.

CREATE SCHEMA IF NOT EXISTS openwa;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openwa_app') THEN
    CREATE ROLE openwa_app WITH LOGIN PASSWORD 'openwa_app_local_change_me';
  END IF;
END $$;

GRANT USAGE ON SCHEMA openwa TO openwa_app;
GRANT ALL ON ALL TABLES IN SCHEMA openwa TO openwa_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA openwa TO openwa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA openwa GRANT ALL ON TABLES TO openwa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA openwa GRANT ALL ON SEQUENCES TO openwa_app;

REVOKE ALL ON SCHEMA public FROM openwa_app;
