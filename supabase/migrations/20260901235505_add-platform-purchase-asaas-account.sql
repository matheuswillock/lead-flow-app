-- E4 de [[40 — Checkout, Adesões e Add-ons — Backend]] (C33, "5º ponto"):
-- asaasPaymentId deixa de ser @unique isolado — o mesmo pay_ pode existir
-- nas duas contas Asaas durante a janela dual. A unicidade real passa a
-- ser o par (asaas_payment_id, asaas_account), mesmo padrão já aplicado em
-- corretor_studio_backoffice_payments e corretor_studio_backoffice_adhesions.
--
-- Nota: o diff bruto do Prisma incluiu também um CREATE OR REPLACE FUNCTION
-- + CREATE TRIGGER de prevent_subscription_audit_mutation/
-- trg_prevent_mutation_subscription_change_logs — ruído de drift entre o
-- shadow database local e o schema (já existem via migration anterior,
-- 20 — Assinaturas — Backend E1). Removido deste arquivo para manter a
-- migration focada; CREATE TRIGGER sem IF NOT EXISTS falharia no replay se
-- reaplicado onde o trigger já existe.
drop index if exists "public"."corretor_studio_platform_purchases_asaas_payment_id_key";

alter table "public"."corretor_studio_platform_purchases" add column "asaas_account" public.asaas_account not null default 'primary'::public.asaas_account;

CREATE UNIQUE INDEX corretor_studio_platform_purchases_asaas_payment_account_key ON public.corretor_studio_platform_purchases USING btree (asaas_payment_id, asaas_account);
