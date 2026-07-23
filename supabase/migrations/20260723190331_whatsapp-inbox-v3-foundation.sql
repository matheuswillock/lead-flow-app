-- WhatsApp Inbox V3: additive foundation. Do not remove the legacy JID
-- columns in this migration; application code dual-reads during rollout.
alter type public."WhatsAppContactNameSource" add value if not exists 'PHONE_NUMBER';

alter type public."WhatsAppMessageStatus" add value if not exists 'UNKNOWN';

do $$ begin
  create type public."WhatsAppContactSyncState" as enum ('FRESH', 'STALE', 'UNRESOLVED', 'CONFLICT');
exception when duplicate_object then null;
end $$;

alter table public.team_whatsapp_contacts
  add column if not exists "phoneE164" text,
  add column if not exists name text,
  -- `PHONE_NUMBER` was added to the enum immediately above. PostgreSQL does
  -- not allow a newly-added enum value to be used as a default until this
  -- migration transaction commits. Keep this nullable until the following
  -- migration can backfill existing rows with the correct source.
  add column if not exists "nameSource" public."WhatsAppContactNameSource",
  add column if not exists "searchText" text,
  add column if not exists "syncState" public."WhatsAppContactSyncState" not null default 'FRESH',
  add column if not exists "lastSeenAt" timestamptz;

alter table public.whatsapp_conversations
  add column if not exists "contactId" uuid references public.team_whatsapp_contacts(id) on delete set null;

alter table public.whatsapp_messages
  add column if not exists "clientMessageId" text;

create unique index if not exists whatsapp_messages_team_client_message_id_key
  on public.whatsapp_messages ("teamId", "clientMessageId")
  where "clientMessageId" is not null;
create unique index if not exists team_whatsapp_contacts_team_phone_e164_key
  on public.team_whatsapp_contacts ("teamId", "phoneE164")
  where "phoneE164" is not null;
create index if not exists team_whatsapp_contacts_team_search_text_idx
  on public.team_whatsapp_contacts ("teamId", "searchText");
create index if not exists team_whatsapp_contacts_sync_idx
  on public.team_whatsapp_contacts ("teamId", "syncState", "lastSyncedAt");
create index if not exists whatsapp_conversations_team_contact_idx
  on public.whatsapp_conversations ("teamId", "contactId");

create table if not exists public.whatsapp_contact_identities (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references public.corretor_studio_teams(id) on delete cascade,
  "configId" uuid references public.team_whatsapp_configs(id) on delete cascade,
  "contactId" uuid not null references public.team_whatsapp_contacts(id) on delete cascade,
  "remoteJid" text not null,
  "identityType" text not null check ("identityType" in ('PHONE', 'LID', 'GROUP', 'UNKNOWN')),
  "phoneE164" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("teamId", "configId", "remoteJid")
);
create index if not exists whatsapp_contact_identities_team_contact_idx
  on public.whatsapp_contact_identities ("teamId", "contactId");

-- Operational records are accessed only through server routes/Prisma. The UI
-- receives a curated projection and must not inspect raw identities/payloads.
alter table public.whatsapp_contact_identities enable row level security;
alter table public.whatsapp_outbound_commands enable row level security;
alter table public.whatsapp_webhook_events enable row level security;
revoke all on table public.whatsapp_contact_identities from anon, authenticated;
revoke all on table public.whatsapp_outbound_commands from anon, authenticated;
revoke all on table public.whatsapp_webhook_events from anon, authenticated;
