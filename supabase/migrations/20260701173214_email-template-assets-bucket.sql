-- O ambiente db-only não sobe o Storage API local. Estes objetos mínimos
-- mantêm o replay de migrations determinístico; em um Supabase completo,
-- CREATE IF NOT EXISTS preserva o schema oficial já existente.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  owner_id text,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text,
  owner_id text,
  metadata jsonb,
  path_tokens text[],
  version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER SCHEMA storage OWNER TO postgres;
ALTER TABLE storage.buckets OWNER TO postgres;
ALTER TABLE storage.objects OWNER TO postgres;

-- Bucket público para imagens de templates de e-mail (PNG/JPG/WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-template-assets',
  'email-template-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (URLs em <img src> nos e-mails)
DROP POLICY IF EXISTS "email_template_assets_public_read" ON storage.objects;
CREATE POLICY "email_template_assets_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-template-assets');
