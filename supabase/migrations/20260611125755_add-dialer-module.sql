-- Dialer module (Studio Voice): enums, tabelas, campos em teams/lead_attachments,
-- indices (incluindo unico parcial de 1 chamada ativa por operador) e RLS.
-- Acesso aos dados e exclusivamente via API (service role); sem policies de SELECT
-- para o client — o painel realtime usa broadcast, nao postgres_changes.

-- ============================================
-- Enums
-- ============================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'dialer_campaign_status' and n.nspname = 'public') then
    create type "public"."dialer_campaign_status" as enum ('draft', 'ready', 'running', 'paused', 'completed', 'canceled', 'limit_reached');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'dialer_call_status' and n.nspname = 'public') then
    create type "public"."dialer_call_status" as enum ('pending', 'calling', 'answered', 'transferred', 'completed', 'no_answer', 'busy', 'failed', 'machine');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'dialer_plan' and n.nspname = 'public') then
    create type "public"."dialer_plan" as enum ('dialer_basic', 'dialer_pro', 'dialer_unlimited');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'dialer_subscription_status' and n.nspname = 'public') then
    create type "public"."dialer_subscription_status" as enum ('pending', 'active', 'suspended', 'canceled');
  end if;
end
$$;

-- ============================================
-- Campos novos em tabelas existentes
-- ============================================

alter table "public"."corretor_studio_teams"
  add column if not exists "dialerEnabled" boolean not null default false,
  add column if not exists "twilioSubaccountSid" text,
  add column if not exists "twilioSubaccountToken" text,
  add column if not exists "twilioApiKeySid" text,
  add column if not exists "twilioApiKeySecret" text,
  add column if not exists "twilioAppSid" text,
  add column if not exists "twilioNumberSid" text,
  add column if not exists "twilioPhoneNumber" text;

alter table "public"."corretor_studio_lead_attachments"
  add column if not exists "isProtected" boolean not null default false;

-- ============================================
-- Tabelas do modulo
-- ============================================

create table if not exists "public"."corretor_studio_dialer_campaigns" (
  "id" uuid not null,
  "teamId" uuid not null,
  "managerId" uuid not null,
  "name" text not null,
  "description" text,
  "status" public.dialer_campaign_status not null default 'draft'::public.dialer_campaign_status,
  "totalContacts" integer not null default 0,
  "contactsProcessed" integer not null default 0,
  "contactsAnswered" integer not null default 0,
  "minutesUsed" numeric(10,2) not null default 0,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null,
  constraint "corretor_studio_dialer_campaigns_pkey" primary key ("id"),
  constraint "corretor_studio_dialer_campaigns_teamId_fkey" foreign key ("teamId") references "public"."corretor_studio_teams" ("id") on delete cascade on update cascade,
  constraint "corretor_studio_dialer_campaigns_managerId_fkey" foreign key ("managerId") references "public"."corretor_studio_profiles" ("id") on delete cascade on update cascade
);

create table if not exists "public"."corretor_studio_dialer_contacts" (
  "id" uuid not null,
  "campaignId" uuid not null,
  "name" text not null,
  "phone" text not null,
  "email" text,
  "metadata" jsonb,
  "processed" boolean not null default false,
  "position" integer not null,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  constraint "corretor_studio_dialer_contacts_pkey" primary key ("id"),
  constraint "corretor_studio_dialer_contacts_campaignId_fkey" foreign key ("campaignId") references "public"."corretor_studio_dialer_campaigns" ("id") on delete cascade on update cascade
);

create table if not exists "public"."corretor_studio_dialer_calls" (
  "id" uuid not null,
  "campaignId" uuid not null,
  "contactId" uuid not null,
  "operatorId" uuid not null,
  "leadId" uuid,
  "twilioCallSid" text,
  "status" public.dialer_call_status not null default 'pending'::public.dialer_call_status,
  "durationSeconds" integer,
  "recordingSid" text,
  "recordingUrl" text,
  "recordingPath" text,
  "startedAt" timestamp(6) with time zone,
  "answeredAt" timestamp(6) with time zone,
  "transferredAt" timestamp(6) with time zone,
  "endedAt" timestamp(6) with time zone,
  "notes" text,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null,
  constraint "corretor_studio_dialer_calls_pkey" primary key ("id"),
  constraint "corretor_studio_dialer_calls_campaignId_fkey" foreign key ("campaignId") references "public"."corretor_studio_dialer_campaigns" ("id") on delete cascade on update cascade,
  constraint "corretor_studio_dialer_calls_contactId_fkey" foreign key ("contactId") references "public"."corretor_studio_dialer_contacts" ("id") on delete cascade on update cascade,
  constraint "corretor_studio_dialer_calls_operatorId_fkey" foreign key ("operatorId") references "public"."corretor_studio_profiles" ("id") on delete restrict on update cascade,
  constraint "corretor_studio_dialer_calls_leadId_fkey" foreign key ("leadId") references "public"."corretor_studio_leads" ("id") on delete set null on update cascade
);

create table if not exists "public"."corretor_studio_dialer_usage" (
  "id" uuid not null,
  "teamId" uuid not null,
  "billingMonth" text not null,
  "minutesUsed" numeric(10,2) not null default 0,
  "minutesLimit" numeric(10,2) not null,
  "callsCount" integer not null default 0,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null,
  constraint "corretor_studio_dialer_usage_pkey" primary key ("id"),
  constraint "corretor_studio_dialer_usage_teamId_fkey" foreign key ("teamId") references "public"."corretor_studio_teams" ("id") on delete cascade on update cascade
);

create table if not exists "public"."corretor_studio_dialer_subscriptions" (
  "id" uuid not null,
  "teamId" uuid not null,
  "plan" public.dialer_plan not null,
  "status" public.dialer_subscription_status not null default 'pending'::public.dialer_subscription_status,
  "asaasSubscriptionId" text,
  "monthlyMinutes" integer not null,
  "currentPeriodStart" timestamp(6) with time zone,
  "currentPeriodEnd" timestamp(6) with time zone,
  "canceledAt" timestamp(6) with time zone,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null,
  constraint "corretor_studio_dialer_subscriptions_pkey" primary key ("id"),
  constraint "corretor_studio_dialer_subscriptions_teamId_fkey" foreign key ("teamId") references "public"."corretor_studio_teams" ("id") on delete cascade on update cascade
);

-- ============================================
-- Indices
-- ============================================

create index if not exists "corretor_studio_dialer_campaigns_teamId_status_idx"
  on "public"."corretor_studio_dialer_campaigns" using btree ("teamId", "status");

create index if not exists "corretor_studio_dialer_campaigns_managerId_idx"
  on "public"."corretor_studio_dialer_campaigns" using btree ("managerId");

-- Garante unicidade de telefone por campanha (backstop para uploads concorrentes)
create unique index if not exists "corretor_studio_dialer_contacts_campaignId_phone_key"
  on "public"."corretor_studio_dialer_contacts" using btree ("campaignId", "phone");

create index if not exists "corretor_studio_dialer_contacts_campaignId_processed_idx"
  on "public"."corretor_studio_dialer_contacts" using btree ("campaignId", "processed");

create unique index if not exists "corretor_studio_dialer_calls_twilioCallSid_key"
  on "public"."corretor_studio_dialer_calls" using btree ("twilioCallSid");

create index if not exists "corretor_studio_dialer_calls_campaignId_status_idx"
  on "public"."corretor_studio_dialer_calls" using btree ("campaignId", "status");

create index if not exists "corretor_studio_dialer_calls_contactId_idx"
  on "public"."corretor_studio_dialer_calls" using btree ("contactId");

create index if not exists "corretor_studio_dialer_calls_operatorId_idx"
  on "public"."corretor_studio_dialer_calls" using btree ("operatorId");

create index if not exists "corretor_studio_dialer_calls_leadId_idx"
  on "public"."corretor_studio_dialer_calls" using btree ("leadId");

-- Garante 1 chamada ativa por operador (indice unico parcial — nao expressavel no Prisma)
create unique index if not exists "corretor_studio_dialer_calls_one_active_call_per_operator"
  on "public"."corretor_studio_dialer_calls" using btree ("operatorId")
  where "status" in ('calling', 'answered', 'transferred');

create unique index if not exists "corretor_studio_dialer_usage_teamId_billingMonth_key"
  on "public"."corretor_studio_dialer_usage" using btree ("teamId", "billingMonth");

create unique index if not exists "corretor_studio_dialer_subscriptions_teamId_key"
  on "public"."corretor_studio_dialer_subscriptions" using btree ("teamId");

create index if not exists "corretor_studio_dialer_subscriptions_asaasSubscriptionId_idx"
  on "public"."corretor_studio_dialer_subscriptions" using btree ("asaasSubscriptionId");

-- ============================================
-- RLS (sem policies de SELECT para o client: acesso somente via API/service role)
-- ============================================

alter table "public"."corretor_studio_dialer_campaigns" enable row level security;
alter table "public"."corretor_studio_dialer_contacts" enable row level security;
alter table "public"."corretor_studio_dialer_calls" enable row level security;
alter table "public"."corretor_studio_dialer_usage" enable row level security;
alter table "public"."corretor_studio_dialer_subscriptions" enable row level security;
