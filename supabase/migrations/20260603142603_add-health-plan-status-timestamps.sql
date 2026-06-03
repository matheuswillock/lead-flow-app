alter table public.corretor_studio_health_plan_options
  add column if not exists "activatedAt"   timestamptz,
  add column if not exists "deactivatedAt" timestamptz;
