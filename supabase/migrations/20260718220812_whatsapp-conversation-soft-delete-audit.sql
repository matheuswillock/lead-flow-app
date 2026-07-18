-- Soft-delete for WhatsApp conversations + durable audit trail.
alter table public.whatsapp_conversations
  add column if not exists "deletedAt" timestamptz;

create index if not exists whatsapp_conversations_deleted_at_idx
  on public.whatsapp_conversations ("deletedAt");

create table if not exists public.whatsapp_audit_events (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references "public"."corretor_studio_teams"("id") on delete cascade,
  "conversationId" uuid references public.whatsapp_conversations(id) on delete set null,
  "actorProfileId" uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists whatsapp_audit_events_team_created_at_idx
  on public.whatsapp_audit_events ("teamId", "createdAt" desc);

create index if not exists whatsapp_audit_events_conversation_idx
  on public.whatsapp_audit_events ("conversationId");
