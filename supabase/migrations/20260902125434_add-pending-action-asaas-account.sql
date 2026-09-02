alter table "public"."corretor_studio_pending_actions" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

-- Achado Codex de terceira rodada (PR #1137, P1): "createdAt" é o instante em
-- que a PendingAction NASCE (pending, sem paymentId ainda) — updatePaymentId
-- só grava o paymentId (e, a partir desta mudança, a conta) bem depois, no
-- checkout. Uma action criada pouco antes do cutover pode receber seu
-- paymentId pouco DEPOIS — createdAt sozinho relabelaria essa linha como
-- legacy quando na verdade nasceu na primary nova.
do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  -- Preferência 1: evidência real — o próprio evento de webhook do Asaas
  -- para este paymentId, que já grava em qual conta ele chegou
  -- (asaas_webhook_events.account, resolvido pelo token que bateu na rota
  -- — mesma semântica documentada no model). Isso é o dado mais confiável
  -- disponível, mais preciso que qualquer timestamp em pending_actions.
  --
  -- Achado cursor[bot] (PR #1137, round 4): resolveAsaasWebhookEventId
  -- (processAsaasWebhookEvent.ts) prioriza body.id — o event id REAL do
  -- Asaas (formato "evt_...") — e só cai no formato "{event}:payment:{id}"
  -- quando body.id vem ausente. Em produção a coluna "id" quase sempre é
  -- "evt_...", então o LIKE por paymentId não casava quase nada. O paymentId
  -- real está em payload->'payment'->>'id' (AsaasWebhookBody.payment.id),
  -- que existe independente do formato do id do evento.
  update "public"."corretor_studio_pending_actions" pa
  set "asaasAccount" = we.account
  from "public"."asaas_webhook_events" we
  where pa."asaasAccount" = 'primary'
    and pa."paymentId" is not null
    and we.payload -> 'payment' ->> 'id' = pa."paymentId"
    and we.account = 'legacy';

  -- Preferência 2 (fallback, sem evento de webhook casado — ex.: cobrança
  -- dispensada/expirada antes de qualquer confirmação): "updatedAt" é uma
  -- aproximação melhor que "createdAt", porque updatePaymentId grava
  -- paymentId e asaasAccount na MESMA escrita — updatedAt < cutover garante
  -- que a última escrita conhecida da linha (logo, a atribuição do
  -- paymentId) aconteceu antes do corte.
  update "public"."corretor_studio_pending_actions"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "paymentId" is not null
    and "updatedAt" < cutover_at;
end $$;
