drop index if exists "public"."corretor_studio_pending_operators_paymentId_key";

alter table "public"."corretor_studio_pending_operators" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

-- Achado Codex (PR #1137, P1, round 7): checkoutSessionId é emitido pelo
-- Asaas por conta — um id histórico da legacy pode colidir com um novo da
-- primary (C33), aplicando o operador errado para o manager errado. Mesmo
-- padrão de backfill já usado em corretor_studio_pending_actions
-- (20260902125434): evidência real do webhook (payload->'payment'->
-- >'externalReference', formato 'pending-operator-{id}' gravado em
-- CheckoutAsaasUseCase.ts:478) como preferência 1, updatedAt < cutover
-- como fallback quando não há evento casado.
do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."corretor_studio_pending_operators" po
  set "asaasAccount" = we.account
  from "public"."asaas_webhook_events" we
  where po."asaasAccount" = 'primary'
    and po."paymentId" is not null
    and we.payload -> 'payment' ->> 'externalReference' = 'pending-operator-' || po.id::text
    and we.account = 'legacy';

  update "public"."corretor_studio_pending_operators"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "paymentId" is not null
    and "updatedAt" < cutover_at;
end $$;

CREATE UNIQUE INDEX corretor_studio_pending_operators_payment_account_key ON public.corretor_studio_pending_operators USING btree ("paymentId", "asaasAccount");
