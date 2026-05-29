with upsert_connections as (
  insert into public.google_oauth_connections (
    "googleEmail",
    "accessToken",
    "refreshToken",
    "tokenExpiresAt",
    "ownerProfileId"
  )
  select
    p."googleEmail",
    p."googleAccessToken",
    p."googleRefreshToken",
    p."googleTokenExpiresAt",
    p.id
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
