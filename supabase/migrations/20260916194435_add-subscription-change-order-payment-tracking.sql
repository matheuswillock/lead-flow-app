alter table "public"."backoffice_subscription_change_orders" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."backoffice_subscription_change_orders" add column "asaasPaymentId" text;

alter table "public"."backoffice_subscription_change_orders" add column "paymentInvoiceUrl" text;
