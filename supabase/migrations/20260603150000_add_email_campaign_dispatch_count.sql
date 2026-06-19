alter table if exists public.corretor_studio_email_campaigns
  add column if not exists "dispatchCount" integer not null default 0;
