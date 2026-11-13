-- Logos próprias dos providers de pagamento para evitar dependência de URLs externas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-provider-logos',
  'payment-provider-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "payment_provider_logos_public_read" ON storage.objects;
CREATE POLICY "payment_provider_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-provider-logos');
