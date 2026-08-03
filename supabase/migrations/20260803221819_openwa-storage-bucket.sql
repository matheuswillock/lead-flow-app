-- Bucket privado para sessões RemoteAuth do OpenWA Gateway (ZIP por instância).
-- Acesso: role openwa_storage (JWT scoped) — NÃO usar service-role no Gateway.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'openwa-sessions',
  'openwa-sessions',
  false,
  104857600,
  ARRAY['application/zip', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openwa_storage') THEN
    CREATE ROLE openwa_storage NOINHERIT NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA storage TO openwa_storage;

DROP POLICY IF EXISTS "openwa_storage_select_sessions" ON storage.objects;
DROP POLICY IF EXISTS "openwa_storage_insert_sessions" ON storage.objects;
DROP POLICY IF EXISTS "openwa_storage_update_sessions" ON storage.objects;
DROP POLICY IF EXISTS "openwa_storage_delete_sessions" ON storage.objects;

CREATE POLICY "openwa_storage_select_sessions"
  ON storage.objects FOR SELECT TO openwa_storage
  USING (bucket_id = 'openwa-sessions');

CREATE POLICY "openwa_storage_insert_sessions"
  ON storage.objects FOR INSERT TO openwa_storage
  WITH CHECK (bucket_id = 'openwa-sessions');

CREATE POLICY "openwa_storage_update_sessions"
  ON storage.objects FOR UPDATE TO openwa_storage
  USING (bucket_id = 'openwa-sessions')
  WITH CHECK (bucket_id = 'openwa-sessions');

CREATE POLICY "openwa_storage_delete_sessions"
  ON storage.objects FOR DELETE TO openwa_storage
  USING (bucket_id = 'openwa-sessions');
