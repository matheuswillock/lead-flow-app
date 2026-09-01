-- E6 (cutover) de [[10 — Fundações Multi-conta — Backend]] — flip de dados
-- que espelha o flip de envs feito no Vercel em 2026-08-31 ~23:25 UTC
-- (ASAAS_API_KEY/ASAAS_WALLET_ID/ASAAS_WEBHOOK_TOKEN passaram a apontar
-- para a conta nova).
--
-- Antes do flip, "primary" significava "a conta do ASAAS_WEBHOOK_TOKEN"
-- = conta antiga. Depois do flip, "primary" passa a significar a conta
-- nova. Todo dado que já existia (default do schema era "primary" antes
-- do cutover, ver 20260831174940_add-asaas-account.sql) precisa virar
-- "legacy" para continuar batendo com os eventos de webhook que a conta
-- antiga (agora resolvida como "legacy" via ASAAS_LEGACY_WEBHOOK_TOKEN)
-- vai continuar mandando para pagamentos/assinaturas já confirmados nela.
--
-- Corte por timestamp só em tabelas onde a coluna de tempo é gravada no
-- MESMO instante em que o vínculo com a conta Asaas é criado
-- (asaas_webhook_events.receivedAt, backoffice_payments.createdAt — a
-- linha só existe depois que a cobrança já foi criada no Asaas). Nas
-- outras duas, timestamp de linha != timestamp do vínculo Asaas, e um
-- filtro por tempo produz falso positivo/negativo (achados P1 do PR
-- #1110, codex + cursor[bot]):
--
--   - backoffice_adhesions: uma adesão pendente sem asaasPaymentId/
--     asaasCustomerId ainda não tem cobrança nenhuma — filtrar por
--     createdAt relabelava ela pra legacy mesmo sem nunca ter tocado a
--     conta antiga, e o próximo checkout (na conta nova) criaria a
--     cobrança na conta errada. Corrigido: só relabela quem já tem
--     identificador Asaas (customer, payment avulso, ou parcela no
--     ledger) — sem isso a linha fica primary, correto.
--   - corretor_studio_profiles: updatedAt sobe em qualquer UPDATE não
--     relacionado a Asaas (o app faz muitos prisma.profile.update em
--     outros fluxos) — usar updatedAt < corte deixava de relabelar
--     profile com asaasCustomerId da conta antiga só porque algo
--     tocou a linha depois do flip. Corrigido: dado que nenhum
--     checkout/cliente novo foi criado no intervalo (confirmado com o
--     owner), todo asaasCustomerId/asaasSubscriptionId não-nulo já
--     rotulado primary só pode pertencer à conta antiga — sem filtro
--     de tempo.
--
-- Idempotente: reaplicar não muda nada (o filtro por account = 'primary'
-- só pega o que ainda não foi relabeled).

do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."asaas_webhook_events"
  set account = 'legacy'
  where account = 'primary'
    and "receivedAt" < cutover_at;

  update "public"."backoffice_payments"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "createdAt" < cutover_at;

  update "public"."backoffice_adhesions" ba
  set "asaasAccount" = 'legacy'
  where ba."asaasAccount" = 'primary'
    and (
      ba."asaasCustomerId" is not null
      or ba."asaasPaymentId" is not null
      or exists (
        select 1
        from jsonb_array_elements(ba."installmentLedger") as entry
        where entry->>'asaasPaymentId' is not null
      )
    );

  update "public"."corretor_studio_profiles"
  set "asaasCustomerAccount" = 'legacy'
  where "asaasCustomerAccount" = 'primary'
    and "asaasCustomerId" is not null;

  update "public"."corretor_studio_profiles"
  set "asaasSubscriptionAccount" = 'legacy'
  where "asaasSubscriptionAccount" = 'primary'
    and "asaasSubscriptionId" is not null;
end $$;
