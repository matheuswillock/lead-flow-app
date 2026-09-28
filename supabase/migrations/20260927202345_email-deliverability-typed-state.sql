create type "public"."email_dmarc_operational_status" as enum ('pending', 'aligned', 'attention', 'failed');

create type "public"."email_domain_health" as enum ('healthy', 'attention', 'paused');

create type "public"."email_domain_temperature" as enum ('warming', 'stable');

create type "public"."email_domain_warmup_status" as enum ('warming', 'established', 'paused');

  create table "public"."backoffice_email_deliverability_daily_metrics" (
    "id" uuid not null,
    "teamId" uuid not null,
    "teamName" text,
    "metricDate" date not null,
    "senderDomain" text not null,
    "recipientProvider" text not null,
    "sent" integer not null default 0,
    "delivered" integer not null default 0,
    "hardBounced" integer not null default 0,
    "softBounced" integer not null default 0,
    "complained" integer not null default 0,
    "humanOpened" integer not null default 0,
    "clicked" integer not null default 0,
    "suppressed" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

  create table "public"."backoffice_email_deliverability_processed_events" (
    "id" uuid not null,
    "eventKey" text not null,
    "processedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );

  create table "public"."corretor_studio_email_deliverability_daily_metrics" (
    "id" uuid not null,
    "teamId" uuid not null,
    "metricDate" date not null,
    "senderDomain" text not null,
    "recipientProvider" text not null,
    "campaignKey" text not null default '__all__'::text,
    "sent" integer not null default 0,
    "delivered" integer not null default 0,
    "hardBounced" integer not null default 0,
    "softBounced" integer not null default 0,
    "complained" integer not null default 0,
    "humanOpened" integer not null default 0,
    "clicked" integer not null default 0,
    "suppressed" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

  create table "public"."corretor_studio_email_dmarc_domain_states" (
    "id" uuid not null,
    "teamId" uuid not null,
    "domain" text not null,
    "status" public.email_dmarc_operational_status not null default 'pending'::public.email_dmarc_operational_status,
    "publishedPolicy" text,
    "diagnostic" text,
    "lastCheckedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

  create table "public"."corretor_studio_email_sending_domain_daily_usage" (
    "id" uuid not null,
    "domainStateId" uuid not null,
    "usageDate" date not null,
    "capacity" integer not null,
    "reserved" integer not null default 0,
    "sent" integer not null default 0,
    "released" integer not null default 0,
    "delivered" integer not null default 0,
    "bounced" integer not null default 0,
    "complained" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

  create table "public"."corretor_studio_email_sending_domain_states" (
    "id" uuid not null,
    "teamId" uuid not null,
    "domain" text not null,
    "stage" integer not null default 0,
    "dailyLimit" integer not null default 100,
    "status" public.email_domain_warmup_status not null default 'warming'::public.email_domain_warmup_status,
    "temperature" public.email_domain_temperature not null default 'warming'::public.email_domain_temperature,
    "health" public.email_domain_health not null default 'healthy'::public.email_domain_health,
    "reason" text,
    "startedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "lastActivityAt" timestamp(6) with time zone,
    "lastProgressedAt" timestamp(6) with time zone,
    "pausedAt" timestamp(6) with time zone,
    "nextEvaluationAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );


CREATE INDEX "backoffice_email_deliverability_daily_metrics_metricDate_idx" ON public.backoffice_email_deliverability_daily_metrics USING btree ("metricDate" DESC);

CREATE UNIQUE INDEX backoffice_email_deliverability_daily_metrics_pkey ON public.backoffice_email_deliverability_daily_metrics USING btree (id);

CREATE INDEX "backoffice_email_deliverability_daily_metrics_teamId_metric_idx" ON public.backoffice_email_deliverability_daily_metrics USING btree ("teamId", "metricDate" DESC);

CREATE UNIQUE INDEX "backoffice_email_deliverability_daily_metrics_teamId_metric_key" ON public.backoffice_email_deliverability_daily_metrics USING btree ("teamId", "metricDate", "senderDomain", "recipientProvider");

CREATE UNIQUE INDEX "backoffice_email_deliverability_processed_events_eventKey_key" ON public.backoffice_email_deliverability_processed_events USING btree ("eventKey");

CREATE UNIQUE INDEX backoffice_email_deliverability_processed_events_pkey ON public.backoffice_email_deliverability_processed_events USING btree (id);

CREATE INDEX "backoffice_email_deliverability_processed_events_processedA_idx" ON public.backoffice_email_deliverability_processed_events USING btree ("processedAt");

CREATE INDEX "corretor_studio_email_deliverability_daily_metrics_metricDa_idx" ON public.corretor_studio_email_deliverability_daily_metrics USING btree ("metricDate");

CREATE UNIQUE INDEX corretor_studio_email_deliverability_daily_metrics_pkey ON public.corretor_studio_email_deliverability_daily_metrics USING btree (id);

CREATE INDEX "corretor_studio_email_deliverability_daily_metrics_teamId_m_idx" ON public.corretor_studio_email_deliverability_daily_metrics USING btree ("teamId", "metricDate" DESC);

CREATE UNIQUE INDEX "corretor_studio_email_deliverability_daily_metrics_teamId_m_key" ON public.corretor_studio_email_deliverability_daily_metrics USING btree ("teamId", "metricDate", "senderDomain", "recipientProvider", "campaignKey");

CREATE UNIQUE INDEX corretor_studio_email_dmarc_domain_states_pkey ON public.corretor_studio_email_dmarc_domain_states USING btree (id);

CREATE INDEX "corretor_studio_email_dmarc_domain_states_status_lastChecke_idx" ON public.corretor_studio_email_dmarc_domain_states USING btree (status, "lastCheckedAt");

CREATE UNIQUE INDEX "corretor_studio_email_dmarc_domain_states_teamId_domain_key" ON public.corretor_studio_email_dmarc_domain_states USING btree ("teamId", domain);

CREATE UNIQUE INDEX "corretor_studio_email_sending_domain_daily_usage_domainStat_key" ON public.corretor_studio_email_sending_domain_daily_usage USING btree ("domainStateId", "usageDate");

CREATE UNIQUE INDEX corretor_studio_email_sending_domain_daily_usage_pkey ON public.corretor_studio_email_sending_domain_daily_usage USING btree (id);

CREATE INDEX "corretor_studio_email_sending_domain_daily_usage_usageDate_idx" ON public.corretor_studio_email_sending_domain_daily_usage USING btree ("usageDate");

CREATE UNIQUE INDEX corretor_studio_email_sending_domain_states_pkey ON public.corretor_studio_email_sending_domain_states USING btree (id);

CREATE INDEX "corretor_studio_email_sending_domain_states_status_nextEval_idx" ON public.corretor_studio_email_sending_domain_states USING btree (status, "nextEvaluationAt");

CREATE UNIQUE INDEX "corretor_studio_email_sending_domain_states_teamId_domain_key" ON public.corretor_studio_email_sending_domain_states USING btree ("teamId", domain);

alter table "public"."backoffice_email_deliverability_daily_metrics" add constraint "backoffice_email_deliverability_daily_metrics_pkey" PRIMARY KEY using index "backoffice_email_deliverability_daily_metrics_pkey";

alter table "public"."backoffice_email_deliverability_processed_events" add constraint "backoffice_email_deliverability_processed_events_pkey" PRIMARY KEY using index "backoffice_email_deliverability_processed_events_pkey";

alter table "public"."corretor_studio_email_deliverability_daily_metrics" add constraint "corretor_studio_email_deliverability_daily_metrics_pkey" PRIMARY KEY using index "corretor_studio_email_deliverability_daily_metrics_pkey";

alter table "public"."corretor_studio_email_dmarc_domain_states" add constraint "corretor_studio_email_dmarc_domain_states_pkey" PRIMARY KEY using index "corretor_studio_email_dmarc_domain_states_pkey";

alter table "public"."corretor_studio_email_sending_domain_daily_usage" add constraint "corretor_studio_email_sending_domain_daily_usage_pkey" PRIMARY KEY using index "corretor_studio_email_sending_domain_daily_usage_pkey";

alter table "public"."corretor_studio_email_sending_domain_states" add constraint "corretor_studio_email_sending_domain_states_pkey" PRIMARY KEY using index "corretor_studio_email_sending_domain_states_pkey";

alter table "public"."corretor_studio_email_deliverability_daily_metrics" add constraint "corretor_studio_email_deliverability_daily_metrics_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_deliverability_daily_metrics" validate constraint "corretor_studio_email_deliverability_daily_metrics_teamId_fkey";

alter table "public"."corretor_studio_email_dmarc_domain_states" add constraint "corretor_studio_email_dmarc_domain_states_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_dmarc_domain_states" validate constraint "corretor_studio_email_dmarc_domain_states_teamId_fkey";

alter table "public"."corretor_studio_email_sending_domain_daily_usage" add constraint "corretor_studio_email_sending_domain_daily_usage_domainSta_fkey" FOREIGN KEY ("domainStateId") REFERENCES public.corretor_studio_email_sending_domain_states(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_sending_domain_daily_usage" validate constraint "corretor_studio_email_sending_domain_daily_usage_domainSta_fkey";

alter table "public"."corretor_studio_email_sending_domain_states" add constraint "corretor_studio_email_sending_domain_states_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_sending_domain_states" validate constraint "corretor_studio_email_sending_domain_states_teamId_fkey";

alter table "public"."corretor_studio_email_campaign_dispatches"
  add column if not exists "originalEligibleRecipients" integer not null default 0,
  add column if not exists "deferredRecipientsPending" integer not null default 0,
  add column if not exists "deferredNextWindowAt" timestamp(6) with time zone,
  add column if not exists "deferredReason" text;
