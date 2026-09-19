-- Achado P1 da revisão (chatgpt-codex-connector + cursor) — 30 — Migração
-- de Conta (execução) E3.
--
-- O cutover de 2026-08-31 (20260831232456_flip-pre-cutover-legacy.sql)
-- relabelou para 'legacy' TODO ponteiro Asaas que já existia, porque depois
-- do flip de envs "primary" passou a significar a conta NOVA. As duas
-- colunas criadas agora em 20260918010221_asaas-account-migration.sql
-- (`backoffice_clients.asaasAccount` e
-- `corretor_studio_profile_subscriptions.asaasSubscriptionAccount`) não
-- existiam naquele dia, então nasceram com o default 'primary' aplicado a
-- linhas que, na verdade, apontam para a conta ANTIGA.
--
-- Sem este backfill, a reconciliação de E7 (que passou a filtrar por conta
-- em 4ef86bd1) classificaria cada um desses ponteiros legados como FANTASMA
-- na varredura da conta legacy e como ponteiro órfão na varredura da
-- primary — ruído diário que esconderia divergência real.
--
-- DISCRIMINADOR DE TEMPO — por que aqui ele é necessário e é seguro:
-- diferente do flip de 31/08, estas colunas são novas, então TODA linha
-- (inclusive as criadas DEPOIS do cutover, que são legitimamente da conta
-- nova) recebeu 'primary'. Um flip cego mandaria para 'legacy' também as
-- linhas corretas. Por isso o corte por `createdAt < cutover`:
--
--   - backoffice_clients.createdAt: a linha é criada junto com o cadastro
--     do cliente no backoffice e o `asaasCustomerId` é gravado nesse mesmo
--     fluxo; linha anterior ao cutover com customer preenchido só pode
--     apontar para a conta antiga.
--   - corretor_studio_profile_subscriptions.createdAt: idem — a assinatura
--     local nasce junto com a criação da assinatura no Asaas.
--
-- A condição de ponteiro não-nulo segue o mesmo cuidado que o flip de 31/08
-- aplicou a backoffice_adhesions: linha sem identificador Asaas nunca tocou
-- conta nenhuma e deve permanecer 'primary'.
--
-- Idempotente: reaplicar não muda nada — o filtro `= 'primary'` só alcança
-- o que ainda não foi relabelado.

do $$
declare
  -- Mesmo instante usado em 20260831232456_flip-pre-cutover-legacy.sql.
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."backoffice_clients"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "asaasCustomerId" is not null
    and "createdAt" < cutover_at;

  update "public"."corretor_studio_profile_subscriptions"
  set "asaasSubscriptionAccount" = 'legacy'
  where "asaasSubscriptionAccount" = 'primary'
    and "asaasSubscriptionId" is not null
    and "createdAt" < cutover_at;
end $$;
