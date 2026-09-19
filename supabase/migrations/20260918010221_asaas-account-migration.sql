create type "public"."asaas_account_migration_status" as enum ('pending', 'customer_created', 'subscription_created', 'legacy_deactivated', 'done', 'requires_card_reauth', 'failed');

  create table "public"."corretor_studio_asaas_account_migrations" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid not null,
    "client_name" text not null,
    "client_email" text not null,
    "legacy_customer_id" text not null,
    "legacy_subscription_id" text,
    "primary_customer_id" text,
    "primary_subscription_id" text,
    "billing_type" text,
    "cycle" text,
    "value" numeric(12,2),
    "next_due_date" timestamp(6) with time zone,
    "notifications_disabled" boolean not null default false,
    "anomaly_notes" text,
    "status" public.asaas_account_migration_status not null default 'pending'::public.asaas_account_migration_status,
    "attempt_count" integer not null default 0,
    "last_error" text,
    "migrated_at" timestamp(6) with time zone,
    "created_at" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );

alter table "public"."backoffice_clients" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

alter table "public"."corretor_studio_profile_subscriptions" add column "asaasSubscriptionAccount" public.asaas_account not null default 'primary'::public.asaas_account;

CREATE UNIQUE INDEX corretor_studio_asaas_account_migrations_legacy_customer_id_key ON public.corretor_studio_asaas_account_migrations USING btree (legacy_customer_id);

CREATE UNIQUE INDEX corretor_studio_asaas_account_migrations_pkey ON public.corretor_studio_asaas_account_migrations USING btree (id);

CREATE INDEX corretor_studio_asaas_account_migrations_status_idx ON public.corretor_studio_asaas_account_migrations USING btree (status);

alter table "public"."corretor_studio_asaas_account_migrations" add constraint "corretor_studio_asaas_account_migrations_pkey" PRIMARY KEY using index "corretor_studio_asaas_account_migrations_pkey";
