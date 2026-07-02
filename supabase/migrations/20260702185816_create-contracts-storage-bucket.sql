-- Bucket privado para PDFs de contrato do backoffice.
-- Sem policy de leitura pública em storage.objects: o acesso ao arquivo
-- só acontece via URL assinada de curta duração, gerada sob demanda
-- pela rota pública de compartilhamento (token com expiração de 24h
-- controlada em backoffice_contract_versions.shareExpiresAt).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backoffice-contracts',
  'backoffice-contracts',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
