-- Domínio público compartilhado por formulários e páginas de conversão.
-- O hostname é derivado do domínio de envio verificado: studio.<domínio>.

do $$ begin
  create type "public"."team_studio_domain_status" as enum ('pending', 'verified', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists "public"."corretor_studio_team_studio_domains" (
    "id" uuid not null default gen_random_uuid(),
    "teamId" uuid not null,
    "hostname" text not null,
    "status" public.team_studio_domain_status not null default 'pending'::public.team_studio_domain_status,
    "vercelDomainId" text,
    "verifiedAt" timestamp(6) with time zone,
    "lastCheckedAt" timestamp(6) with time zone,
    "headScripts" text,
    "bodyStartScripts" text,
    "bodyEndScripts" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
);

alter table public.corretor_studio_team_studio_domains add column if not exists "headScripts" text;
alter table public.corretor_studio_team_studio_domains add column if not exists "bodyStartScripts" text;
alter table public.corretor_studio_team_studio_domains add column if not exists "bodyEndScripts" text;

create unique index if not exists corretor_studio_team_studio_domains_hostname_key
  on public.corretor_studio_team_studio_domains using btree (hostname);
create unique index if not exists corretor_studio_team_studio_domains_pkey
  on public.corretor_studio_team_studio_domains using btree (id);
create unique index if not exists corretor_studio_team_studio_domains_teamId_key
  on public.corretor_studio_team_studio_domains using btree ("teamId");
create index if not exists corretor_studio_team_studio_domains_status_lastCheckedAt_idx
  on public.corretor_studio_team_studio_domains using btree (status, "lastCheckedAt");

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_team_studio_domains_pkey'
      and conrelid = 'public.corretor_studio_team_studio_domains'::regclass
  ) then
    alter table public.corretor_studio_team_studio_domains
      add constraint corretor_studio_team_studio_domains_pkey primary key using index corretor_studio_team_studio_domains_pkey;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_team_studio_domains_teamId_fkey'
      and conrelid = 'public.corretor_studio_team_studio_domains'::regclass
  ) then
    alter table public.corretor_studio_team_studio_domains
      add constraint corretor_studio_team_studio_domains_teamId_fkey
      foreign key ("teamId") references public.corretor_studio_teams(id)
      on update cascade on delete cascade not valid;
    alter table public.corretor_studio_team_studio_domains
      validate constraint corretor_studio_team_studio_domains_teamId_fkey;
  end if;
end $$;
