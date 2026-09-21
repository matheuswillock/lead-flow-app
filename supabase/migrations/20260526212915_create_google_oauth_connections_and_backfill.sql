create table if not exists public.google_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  "googleEmail" text not null unique,
  "accessToken" text,
  "refreshToken" text,
  "tokenExpiresAt" timestamptz,
  scopes text[] not null default '{}',
  "ownerProfileId" uuid references public.corretor_studio_profiles(id) on delete set null,
  "lastRefreshedAt" timestamptz,
  "lastRefreshError" text,
  "revokedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists google_oauth_connections_owner_profile_id_idx
  on public.google_oauth_connections ("ownerProfileId");
create index if not exists google_oauth_connections_google_email_idx
  on public.google_oauth_connections ("googleEmail");

alter table if exists public.google_oauth_connections enable row level security;

alter table public.corretor_studio_profiles
  add column if not exists "googleConnectionId" uuid references public.google_oauth_connections(id) on delete set null;

alter table public.backoffice_users
  add column if not exists "googleConnectionId" uuid references public.google_oauth_connections(id) on delete set null;

alter table public.backoffice_users
  add column if not exists "linkedCorretorStudioProfileId" uuid references public.corretor_studio_profiles(id) on delete set null;

create index if not exists corretor_studio_profiles_google_connection_id_idx
  on public.corretor_studio_profiles ("googleConnectionId");
create index if not exists backoffice_users_google_connection_id_idx
  on public.backoffice_users ("googleConnectionId");
create index if not exists backoffice_users_linked_profile_id_idx
  on public.backoffice_users ("linkedCorretorStudioProfileId");

-- "id"/"createdAt"/"updatedAt" vêm explícitos de propósito: prisma/schema.prisma
-- declara `GoogleOAuthConnection.id` como `@default(uuid())` e `updatedAt` como
-- `@updatedAt` sozinho — os dois são resolvidos no Prisma Client, não no banco.
-- Um `prisma db push` derruba o default físico que o CREATE TABLE acima criou
-- (docs/audits/prisma-migrations-drift-2026-08-23.md §3) e, a partir daí, o
-- replay viola NOT NULL com SQLSTATE 23502 — a mesma falha do PR #1208.
with profile_upsert as (
  insert into public.google_oauth_connections (
    "id",
    "googleEmail",
    "accessToken",
    "refreshToken",
    "tokenExpiresAt",
    "ownerProfileId",
    "createdAt",
    "updatedAt"
  )
  select
    gen_random_uuid(),
    p."googleEmail",
    p."googleAccessToken",
    p."googleRefreshToken",
    p."googleTokenExpiresAt",
    p.id,
    now(),
    now()
  from public.corretor_studio_profiles p
  where p."googleCalendarConnected" = true
    and p."googleRefreshToken" is not null
    and p."googleEmail" is not null
  on conflict ("googleEmail") do update set
    "accessToken" = excluded."accessToken",
    "refreshToken" = excluded."refreshToken",
    "tokenExpiresAt" = excluded."tokenExpiresAt",
    "ownerProfileId" = coalesce(public.google_oauth_connections."ownerProfileId", excluded."ownerProfileId"),
    "updatedAt" = now()
  returning id, "googleEmail"
)
update public.corretor_studio_profiles p
set "googleConnectionId" = c.id
from public.google_oauth_connections c
where p."googleCalendarConnected" = true
  and p."googleRefreshToken" is not null
  and p."googleEmail" is not null
  and p."googleEmail" = c."googleEmail";

-- Mesma blindagem de "id"/"createdAt"/"updatedAt" do INSERT acima.
insert into public.google_oauth_connections (
  "id",
  "googleEmail",
  "accessToken",
  "refreshToken",
  "tokenExpiresAt",
  "createdAt",
  "updatedAt"
)
select
  gen_random_uuid(),
  b."googleEmail",
  b."googleAccessToken",
  b."googleRefreshToken",
  b."googleTokenExpiresAt",
  now(),
  now()
from public.backoffice_users b
where b."googleCalendarConnected" = true
  and b."googleRefreshToken" is not null
  and b."googleEmail" is not null
on conflict ("googleEmail") do update set
  "accessToken" = excluded."accessToken",
  "refreshToken" = excluded."refreshToken",
  "tokenExpiresAt" = excluded."tokenExpiresAt",
  "updatedAt" = now();

update public.backoffice_users b
set "googleConnectionId" = c.id
from public.google_oauth_connections c
where b."googleCalendarConnected" = true
  and b."googleRefreshToken" is not null
  and b."googleEmail" is not null
  and b."googleEmail" = c."googleEmail";

update public.backoffice_users
set "linkedCorretorStudioProfileId" = '0c96a57e-6cc1-400f-bf3a-5740b699ac21'
where id = 'd756734e-e4dd-4572-8f5e-6135514a7902'
  and "linkedCorretorStudioProfileId" is null;

update public.backoffice_users
set "linkedCorretorStudioProfileId" = 'b0737bfd-7bea-493b-8cfc-14946fcea8cd'
where id = 'd336c741-6a21-4e77-8d38-6c72c923b6f4'
  and "linkedCorretorStudioProfileId" is null;

update public.backoffice_users
set "linkedCorretorStudioProfileId" = '8474aaf6-e7d1-4165-9bef-bf76bc701038'
where id = 'f88f2b3b-3f45-4170-83e1-4e7999d2c012'
  and "linkedCorretorStudioProfileId" is null;
