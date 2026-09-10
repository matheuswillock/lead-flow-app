-- E4 de [[40 — Checkout, Adesões e Add-ons — Backend]] (C33, "5º ponto"):
-- asaasPaymentId deixa de ser @unique isolado — o mesmo pay_ pode existir
-- nas duas contas Asaas durante a janela dual. A unicidade real passa a
-- ser o par (asaas_payment_id, asaas_account), mesmo padrão já aplicado em
-- corretor_studio_backoffice_payments e corretor_studio_backoffice_adhesions.
--
-- Achado Codex (PR #1137, P1): o cutover já aconteceu em produção em
-- 2026-08-31 ~23:25 UTC (20260831232456_flip-pre-cutover-legacy.sql) —
-- "primary" antes do flip significava a conta ANTIGA. Toda linha paga
-- ANTES do corte pertence de fato à conta legacy; deixar o default
-- 'primary' as cegas faria um webhook retido/retentado da conta legacy
-- colidir com uma compra nova da primary (exatamente o bug que esta
-- migration existe para fechar). Corte por paid_at (não created_at): é o
-- timestamp gravado no MESMO instante em que o vínculo com a conta Asaas
-- se torna real (markPaidOnce) — created_at é anterior à cobrança em si,
-- mesma ressalva já documentada na migration do flip para
-- backoffice_adhesions. Idempotente: reaplicar não muda nada (filtro por
-- asaas_account = 'primary' só pega o que ainda não foi relabeled).
--
-- Nota: o diff bruto do Prisma incluiu também um CREATE OR REPLACE FUNCTION
-- + CREATE TRIGGER de prevent_subscription_audit_mutation/
-- trg_prevent_mutation_subscription_change_logs — ruído de drift entre o
-- shadow database local e o schema (já existem via migration anterior,
-- 20 — Assinaturas — Backend E1). Removido deste arquivo para manter a
-- migration focada; CREATE TRIGGER sem IF NOT EXISTS falharia no replay se
-- reaplicado onde o trigger já existe.
drop index if exists "public"."corretor_studio_platform_purchases_asaas_payment_id_key";

alter table "public"."corretor_studio_platform_purchases" add column if not exists "asaas_account" public.asaas_account not null default 'primary'::public.asaas_account;

do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."corretor_studio_platform_purchases"
  set asaas_account = 'legacy'
  where asaas_account = 'primary'
    and asaas_payment_id is not null
    and paid_at < cutover_at;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_platform_purchases_asaas_payment_account_key ON public.corretor_studio_platform_purchases USING btree (asaas_payment_id, asaas_account);
