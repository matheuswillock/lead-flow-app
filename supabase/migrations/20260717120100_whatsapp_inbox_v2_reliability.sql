-- Durable WhatsApp delivery and webhook processing primitives.
create type public."WhatsAppOutboundCommandStatus" as enum ('PENDING', 'SENT', 'UNKNOWN', 'FAILED');
create type public."WhatsAppWebhookEventStatus" as enum ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER');

alter table public.whatsapp_messages
  add column if not exists "storagePath" text,
  add column if not exists "mediaSha256" text,
  add column if not exists "mediaSizeBytes" integer,
  add column if not exists "mediaDurationMs" integer,
  add column if not exists "deletedAt" timestamptz;

create index if not exists whatsapp_messages_deleted_at_idx on public.whatsapp_messages ("deletedAt");

create table if not exists public.whatsapp_outbound_commands (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references "public"."corretor_studio_teams"("id") on delete cascade,
  "conversationId" uuid not null references public.whatsapp_conversations(id) on delete cascade,
  "clientMessageId" text not null,
  "messageId" uuid,
  status public."WhatsAppOutboundCommandStatus" not null default 'PENDING',
  "attemptCount" integer not null default 0,
  "lastError" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("teamId", "clientMessageId")
);
create index if not exists whatsapp_outbound_commands_status_updated_at_idx on public.whatsapp_outbound_commands (status, "updatedAt");

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  "configId" uuid not null references public.team_whatsapp_configs(id) on delete cascade,
  "teamId" uuid not null references "public"."corretor_studio_teams"("id") on delete cascade,
  "providerEventId" text,
  "eventType" text not null,
  payload jsonb not null,
  status public."WhatsAppWebhookEventStatus" not null default 'PENDING',
  "attemptCount" integer not null default 0,
  "lastError" text,
  "processedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("configId", "providerEventId")
);
create index if not exists whatsapp_webhook_events_status_created_at_idx on public.whatsapp_webhook_events (status, "createdAt");

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do update set public = false;
