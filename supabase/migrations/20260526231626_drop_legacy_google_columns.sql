drop index if exists public.backoffice_users_google_connected_idx;

alter table public.corretor_studio_profiles
  drop column if exists "googleCalendarConnected",
  drop column if exists "googleAccessToken",
  drop column if exists "googleRefreshToken",
  drop column if exists "googleTokenExpiresAt",
  drop column if exists "googleEmail";

alter table public.backoffice_users
  drop column if exists "googleCalendarConnected",
  drop column if exists "googleAccessToken",
  drop column if exists "googleRefreshToken",
  drop column if exists "googleTokenExpiresAt",
  drop column if exists "googleEmail";
