alter table "public"."backoffice_adhesions"
  add column if not exists "additional_users_data" jsonb not null default '[]'::jsonb,
  add column if not exists "additional_teams_data" jsonb not null default '[]'::jsonb;
