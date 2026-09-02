-- Achado Codex (PR #1137, P1): paymentId sozinho colide entre as duas
-- contas Asaas (C33) — a idempotência real do grant de créditos passa a
-- ser o par (paymentId, asaasAccount), mesmo padrão já aplicado em
-- corretor_studio_platform_purchases (E4) e corretor_studio_backoffice_*.
--
-- Nota: o diff bruto do Prisma incluiu também um CREATE OR REPLACE FUNCTION
-- + CREATE TRIGGER de prevent_subscription_audit_mutation/
-- trg_prevent_mutation_subscription_change_logs — ruído de drift entre o
-- shadow database local e o schema (já existem via migration anterior).
-- Removido deste arquivo pelo mesmo motivo da migration anterior
-- (20260901235505_add-platform-purchase-asaas-account.sql): CREATE TRIGGER
-- sem IF NOT EXISTS falharia no replay se reaplicado onde já existe.
drop index if exists "public"."corretor_studio_email_credit_payment_grants_paymentId_key";

alter table "public"."corretor_studio_email_credit_payment_grants" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

CREATE UNIQUE INDEX corretor_studio_email_credit_payment_grants_payment_account_key ON public.corretor_studio_email_credit_payment_grants USING btree ("paymentId", "asaasAccount");
