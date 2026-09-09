-- Achado Codex (PR #1137, P1): paymentId sozinho colide entre as duas
-- contas Asaas (C33) — a idempotência real do grant de créditos passa a
-- ser o par (paymentId, asaasAccount), mesmo padrão já aplicado em
-- corretor_studio_platform_purchases (E4) e corretor_studio_backoffice_*.
--
-- Achado Codex de segunda rodada (mesmo PR, P1): o cutover já aconteceu em
-- produção em 2026-08-31 ~23:25 UTC
-- (20260831232456_flip-pre-cutover-legacy.sql) — "primary" antes do flip
-- significava a conta ANTIGA. Todo grant criado antes do corte pertence de
-- fato à conta legacy; default 'primary' às cegas faria um webhook
-- retido/retentado da conta legacy colidir com uma compra nova da primary.
-- Corte por "createdAt": esta tabela só ganha uma linha quando o pagamento
-- já foi confirmado (applyPaidPlan, EmailCreditService.ts) — createdAt É o
-- instante em que o vínculo com a conta Asaas se torna real, mesma
-- categoria de asaas_webhook_events.receivedAt/backoffice_payments.createdAt
-- na migration do flip. Idempotente: reaplicar não muda nada.
--
-- Nota: o diff bruto do Prisma incluiu também um CREATE OR REPLACE FUNCTION
-- + CREATE TRIGGER de prevent_subscription_audit_mutation/
-- trg_prevent_mutation_subscription_change_logs — ruído de drift entre o
-- shadow database local e o schema (já existem via migration anterior).
-- Removido deste arquivo pelo mesmo motivo da migration anterior
-- (20260901235505_add-platform-purchase-asaas-account.sql): CREATE TRIGGER
-- sem IF NOT EXISTS falharia no replay se reaplicado onde já existe.
drop index if exists "public"."corretor_studio_email_credit_payment_grants_paymentId_key";

alter table "public"."corretor_studio_email_credit_payment_grants" add column if not exists "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  -- Achado Codex de rodada posterior (PR #1137, P1): um checkout legacy que
  -- LIQUIDA depois do cutover (janela dual — PENDING/OVERDUE legadas seguem
  -- liquidando na conta antiga) gera grant com createdAt > cutover_at, e o
  -- corte por createdAt sozinho deixaria essa linha rotulada 'primary'.
  -- Preferência 1: evidência real de webhook — o grant nasce de uma
  -- PlatformPurchase (applyPaidPlan via ApplyEmailCreditsPaidPurchaseUseCase);
  -- a purchase tem external_reference único ('platform-purchase-{id}') que o
  -- Asaas devolve no payload do evento. asaas_webhook_events.account é a
  -- conta cujo token validou o evento — mesmo padrão da migration
  -- 20260902125434 (pending actions), que já rejeitou o join por paymentId
  -- cru por reabrir o C33.
  update "public"."corretor_studio_email_credit_payment_grants" g
  set "asaasAccount" = 'legacy'
  from "public"."corretor_studio_platform_purchases" pp
  where g."asaasAccount" = 'primary'
    and pp."asaas_payment_id" = g."paymentId"
    and exists (
      select 1
      from "public"."asaas_webhook_events" we
      where we.payload -> 'payment' ->> 'externalReference' = pp."external_reference"
        and we.account = 'legacy'
    );

  -- Preferência 2 (fallback, sem evento casado): o grant só é criado com o
  -- pagamento já confirmado (applyPaidPlan) — createdAt É o instante do
  -- vínculo com a conta. Cobre o estoque pré-cutover; o residual (grant
  -- pós-cutover de pagamento legacy SEM evento de webhook persistido) não
  -- tem fonte de evidência melhor disponível no schema.
  update "public"."corretor_studio_email_credit_payment_grants"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "createdAt" < cutover_at;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_email_credit_payment_grants_payment_account_key ON public.corretor_studio_email_credit_payment_grants USING btree ("paymentId", "asaasAccount");
