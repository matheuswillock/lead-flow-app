-- WhatsApp Inbox V3, Fases 0–2. Aditiva e segura para rollout gradual.
-- Nenhuma coluna legada é removida nesta migration.

alter type public."WhatsAppMessageStatus" add value if not exists 'PLAYED';

alter table public.whatsapp_messages
  add column if not exists "playedAt" timestamptz;

alter table public.whatsapp_outbound_commands
  add column if not exists "requestHash" text,
  add column if not exists "claimedAt" timestamptz,
  add column if not exists "nextReconcileAt" timestamptz;
create index if not exists whatsapp_outbound_commands_reconcile_idx
  on public.whatsapp_outbound_commands (status, "nextReconcileAt");

alter table public.whatsapp_contact_identities
  add column if not exists "mappingSource" text not null default 'CONTACT_SYNC',
  add column if not exists "verifiedAt" timestamptz,
  add column if not exists sendable boolean not null default false,
  add column if not exists "firstSeenAt" timestamptz not null default now(),
  add column if not exists "lastSeenAt" timestamptz not null default now();
create index if not exists whatsapp_contact_identities_config_kind_seen_idx
  on public.whatsapp_contact_identities ("configId", "identityType", "lastSeenAt");

create table if not exists public.whatsapp_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references public.corretor_studio_teams(id) on delete cascade,
  "configId" uuid not null references public.team_whatsapp_configs(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED')),
  checkpoint jsonb not null default '{}'::jsonb,
  "leaseOwner" text,
  "leaseExpiresAt" timestamptz,
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists whatsapp_sync_jobs_claim_idx
  on public.whatsapp_sync_jobs (status, "leaseExpiresAt", "createdAt");
create index if not exists whatsapp_sync_jobs_team_config_idx
  on public.whatsapp_sync_jobs ("teamId", "configId", status);

-- Registros operacionais nunca são Data API/Realtime do browser.
alter table public.whatsapp_sync_jobs enable row level security;
revoke all on table public.whatsapp_sync_jobs from anon, authenticated;
revoke all on table public.whatsapp_contact_identities from anon, authenticated;
revoke all on table public.whatsapp_outbound_commands from anon, authenticated;
revoke all on table public.whatsapp_webhook_events from anon, authenticated;
