-- SPEC 20 — Webhooks de Saída — DA1 (segredo de assinatura HMAC por webhook)
--
-- Gerado via `bun run db:migrate:from-prisma -- add-team-webhook-signing-secret`
-- a partir de `prisma/schema.prisma` (model TeamWebhook, sem @map — nomes
-- físicos iguais ao nome do campo, mesmo padrão de "tokenCipher"/"tokenPreview"
-- já existentes nesta tabela):
--   - "signingSecretCipher": segredo cifrado com AES-256-GCM (mesmo algoritmo
--     do token de webhook de entrada, lib/webhooks/studioWebhookSecurity.ts).
--   - "signingSecretPreview": prévia curta exibida na tela, nunca o segredo
--     completo.
--
-- Substitui o arquivo homônimo anterior (20260921235600), que havia sido
-- criado manualmente via `db:migrate:new` por engano — esta mudança pertence
-- ao fluxo de schema (`db:migrate:from-prisma`) porque os campos já existem
-- em `prisma/schema.prisma`. `if not exists` adicionado manualmente após a
-- geração para manter o padrão de idempotência das demais migrations deste
-- repositório.
alter table "public"."corretor_studio_team_webhooks"
  add column if not exists "signingSecretCipher" text,
  add column if not exists "signingSecretPreview" text;
