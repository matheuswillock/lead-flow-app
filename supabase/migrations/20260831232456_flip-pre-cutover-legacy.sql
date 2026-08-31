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
-- Corte por timestamp: só relabela o que já existia ANTES do flip. Nada
-- criado pela conta nova depois desse instante é tocado — continua
-- corretamente "primary". Confirmado com o owner que nenhum
-- pagamento/checkout novo aconteceu entre o flip e a aplicação desta
-- migration (janela de poucos minutos).
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

  update "public"."backoffice_adhesions"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "createdAt" < cutover_at;

  -- Profile não tem uma coluna de "quando o asaasCustomerId/subscriptionId
  -- foi atribuído" — usa updatedAt como proxy conservador: só relabela
  -- linhas que não foram tocadas depois do corte, então nada criado pela
  -- conta nova no intervalo é capturado por engano.
  update "public"."corretor_studio_profiles"
  set "asaasCustomerAccount" = 'legacy'
  where "asaasCustomerAccount" = 'primary'
    and "asaasCustomerId" is not null
    and "updatedAt" < cutover_at;

  update "public"."corretor_studio_profiles"
  set "asaasSubscriptionAccount" = 'legacy'
  where "asaasSubscriptionAccount" = 'primary'
    and "asaasSubscriptionId" is not null
    and "updatedAt" < cutover_at;
end $$;
