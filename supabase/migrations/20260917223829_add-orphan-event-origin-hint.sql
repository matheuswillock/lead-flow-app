-- Classificação de origem carimbada no evento órfão do webhook do Resend.
--
-- Os sinais crus de origem (user-agent, IP) só existem no payload do webhook.
-- Quando o open/clique chega ANTES do `EmailLog`, o evento é enfileirado em
-- `email_orphan_events` e reaplicado depois pelo dreno — até aqui, sem origem
-- nenhuma. O resultado é que a abertura humana recuperada nunca reivindicava
-- `humanOpenedAt`/`totalOpenedHuman` e ficava fora dos segmentos humanos do
-- Radar (predicado `metadata.origin.classification = 'human'`).
--
-- Só o RESULTADO da classificação é persistido (`classification`, `botSource`,
-- `uaFamily`) — o IP continua morrendo em memória no classificador (LGPD).
--
-- Nome físico conferido com @@map em prisma/schema.prisma:
--   EmailOrphanEvent -> email_orphan_events
--
-- O diff do `supabase db diff` trouxe junto um recreate de
-- "public"."notification_type" que é ruído conhecido do shadow database (a
-- migration 20260803225708_crm-tags-contacts-doc-requests.sql já contém todos
-- os labels) — removido de propósito; esta migration muda uma coluna só.

alter table "public"."email_orphan_events"
  add column if not exists "originHint" jsonb;
