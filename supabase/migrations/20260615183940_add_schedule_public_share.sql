alter table public.corretor_studio_leads_schedule
  add column if not exists "publicShareTokenHash" text,
  add column if not exists "publicShareExpiresAt" timestamptz(6);

create index if not exists corretor_studio_leads_schedule_public_share_token_hash_idx
  on public.corretor_studio_leads_schedule ("publicShareTokenHash");
