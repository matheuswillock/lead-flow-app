-- SPEC 40 E4/DA4 — opt-out explícito de captação de leads no formulário público.
--
-- Publica sem pergunta de contato mapeada (formulário de pesquisa) e, em troca,
-- suprime as métricas de lead daquele form: sem captação, sem promessa de funil.
-- Default `false` — a exigência de contato liga por padrão.
--
-- Gerado com `bun run db:migrate:new` em vez de `db:migrate:from-prisma`: o
-- banco local está com drift em constraints `@@unique` de outras tabelas
-- (whatsapp_*, email_events, email_credit_subscriptions), então o `prisma db
-- push` do gerador aborta pedindo `--accept-data-loss` e o diff resultante
-- traria essas mudanças alheias junto. A coluna abaixo é aditiva e usa o nome
-- físico do `@@map("corretor_studio_public_forms")`.

alter table "public"."corretor_studio_public_forms"
  add column if not exists "leadCaptureDisabled" boolean not null default false;
