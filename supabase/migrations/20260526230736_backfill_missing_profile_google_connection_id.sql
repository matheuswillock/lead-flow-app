-- "id"/"createdAt"/"updatedAt" vêm explícitos de propósito: prisma/schema.prisma
-- declara `GoogleOAuthConnection.id` como `@default(uuid())` e `updatedAt` como
-- `@updatedAt` sozinho — os dois são resolvidos no Prisma Client, não no banco.
-- Um `prisma db push` derruba o default físico da tabela
-- (docs/audits/prisma-migrations-drift-2026-08-23.md §3) e, a partir daí, o
-- replay viola NOT NULL com SQLSTATE 23502 — a mesma falha do PR #1208.
with upsert_connections as (
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
    and p."googleConnectionId" is null
    and p."googleEmail" is not null
  on conflict ("googleEmail") do update set
    "accessToken" = coalesce(excluded."accessToken", public.google_oauth_connections."accessToken"),
    "refreshToken" = coalesce(excluded."refreshToken", public.google_oauth_connections."refreshToken"),
    "tokenExpiresAt" = coalesce(excluded."tokenExpiresAt", public.google_oauth_connections."tokenExpiresAt"),
    "ownerProfileId" = coalesce(public.google_oauth_connections."ownerProfileId", excluded."ownerProfileId"),
    "updatedAt" = now()
  returning id, "googleEmail"
)
update public.corretor_studio_profiles p
set "googleConnectionId" = c.id
from public.google_oauth_connections c
where p."googleCalendarConnected" = true
  and p."googleConnectionId" is null
  and p."googleEmail" is not null
  and p."googleEmail" = c."googleEmail";
