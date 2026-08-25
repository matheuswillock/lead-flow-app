-- SPEC 40 E4/DA4 — opt-out explícito de captação de leads no formulário público.
--
-- Publica sem pergunta de contato mapeada (formulário de pesquisa) e, em troca,
-- suprime as métricas de lead daquele form: sem captação, sem promessa de funil.
-- Default `false` — a exigência de contato liga por padrão.
--
-- Gerada por `bun run db:migrate:from-prisma -- add-public-form-lead-capture-disabled`
-- (review #1043) e **podada** para este único statement. O diff bruto veio com
-- 417 statements: 1 meu e 416 de drift pré-existente entre
-- `supabase/migrations/**` e `prisma/schema.prisma` — dezenas de
-- `alter column … set data type timestamp(6) with time zone` em tabelas alheias
-- (`whatsapp_*`, `email_*`), que o histórico cria como `timestamp` sem timezone
-- enquanto o schema declara `timestamptz`. É o drift catalogado em
-- `docs/audits/prisma-migrations-drift-2026-08-23.md`; levá-lo junto seria
-- despejar uma migração de tipo não revisada em produção de carona com uma
-- coluna booleana.
--
-- `if not exists` porque a coluna já pode ter chegado ao banco por `db push`
-- em ambiente de desenvolvimento.

alter table "public"."corretor_studio_public_forms"
  add column if not exists "leadCaptureDisabled" boolean not null default false;
