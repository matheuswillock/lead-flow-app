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
