create type "public"."asaas_account" as enum ('primary', 'legacy');

drop index if exists "public"."backoffice_adhesions_asaasPaymentId_key";

drop index if exists "public"."backoffice_payments_asaasPaymentId_key";

alter table "public"."asaas_webhook_events" add column "account" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."backoffice_adhesions" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."backoffice_payments" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."corretor_studio_profiles" add column "asaasCustomerAccount" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."corretor_studio_profiles" add column "asaasSubscriptionAccount" public.asaas_account not null default 'primary'::public.asaas_account;

CREATE UNIQUE INDEX backoffice_adhesions_asaas_payment_account_key ON public.backoffice_adhesions USING btree ("asaasPaymentId", "asaasAccount");

CREATE UNIQUE INDEX backoffice_payments_asaas_payment_account_key ON public.backoffice_payments USING btree ("asaasPaymentId", "asaasAccount");

CREATE INDEX corretor_studio_profiles_asaas_customer_account_idx ON public.corretor_studio_profiles USING btree ("asaasCustomerId", "asaasCustomerAccount");

CREATE INDEX corretor_studio_profiles_asaas_subscription_account_idx ON public.corretor_studio_profiles USING btree ("asaasSubscriptionId", "asaasSubscriptionAccount");
