-- Bucket privado para imagens anexadas a pedidos de suporte.
-- Sem policy de leitura pública em storage.objects: o acesso ao arquivo
-- só acontece via URL assinada, gerada sob demanda pelo backend ao montar
-- a mensagem enviada ao webhook do Slack.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-request-attachments',
  'support-request-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
