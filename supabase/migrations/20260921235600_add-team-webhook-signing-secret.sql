-- SPEC 20 — Webhooks de Saída — DA1 (segredo de assinatura HMAC por webhook)
--
-- Adiciona as duas colunas usadas por `TeamWebhook` para a assinatura HMAC de
-- saída (`prisma/schema.prisma`, model TeamWebhook, sem @map — nomes físicos
-- iguais ao nome do campo, mesmo padrão de "tokenCipher"/"tokenPreview" já
-- existentes nesta tabela):
--   - "signingSecretCipher": segredo cifrado com AES-256-GCM (mesmo
--     algoritmo do token de webhook de entrada, lib/webhooks/studioWebhookSecurity.ts).
--   - "signingSecretPreview": prévia curta exibida na tela, nunca o segredo completo.
--
-- Gerado manualmente via `bun run db:migrate:new` (não por
-- `db:migrate:from-prisma`) porque o banco local compartilhado
-- (porta 55322) está sendo usado concorrentemente por outros agentes desta
-- mesma rodada, cada um rodando `prisma db push --accept-data-loss` contra o
-- schema do próprio worktree — o que reverte colunas de outros agentes a
-- cada execução e contamina o diff automático com mudanças alheias
-- (confirmado em 21/09 durante a implementação: o diff automático trouxe
-- `contractVersion` e a tabela de rate limit de outras SPECs, sem trazer
-- estas duas colunas). O SQL abaixo é aditivo e idempotente.
alter table "public"."corretor_studio_team_webhooks"
  add column if not exists "signingSecretCipher" text,
  add column if not exists "signingSecretPreview" text;
