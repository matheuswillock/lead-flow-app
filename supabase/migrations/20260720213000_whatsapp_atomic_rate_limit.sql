-- WhatsApp Inbox V2.5: atomic per-team send reservation.
create table if not exists public.whatsapp_send_rate_limit_windows (
  "teamId" uuid not null references public.corretor_studio_teams(id) on delete cascade,
  "windowStart" timestamptz not null,
  count integer not null default 0 check (count >= 0),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  primary key ("teamId", "windowStart")
);

alter table public.whatsapp_send_rate_limit_windows enable row level security;
-- No Data API grants: the table is only consumed by the server-side Prisma client.
