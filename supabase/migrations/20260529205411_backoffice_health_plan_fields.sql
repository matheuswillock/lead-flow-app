alter table public.corretor_studio_health_plan_options
  add column if not exists "isActive" boolean not null default true,
  add column if not exists "isDefault" boolean not null default false,
  add column if not exists "iconUrl" text;

drop index if exists corretor_studio_health_plan_options_one_default_active_idx;
create unique index corretor_studio_health_plan_options_one_default_active_idx
  on public.corretor_studio_health_plan_options (("isDefault"))
  where "isDefault" = true and "isActive" = true;
