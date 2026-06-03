create table if not exists "public"."email_team_settings" (
    "id"        uuid           not null default gen_random_uuid(),
    "teamId"    uuid           not null,
    "fromName"  text           not null default 'Corretor Studio',
    "fromEmail" text           not null default 'no-reply@corretorstudio.com',
    "replyTo"   text,
    "createdAt" timestamptz(6) not null default now(),
    "updatedAt" timestamptz(6) not null default now()
);

alter table "public"."email_team_settings" enable row level security;

create unique index if not exists "email_team_settings_pkey"
    on "public"."email_team_settings" using btree ("id");

create unique index if not exists "email_team_settings_teamId_key"
    on "public"."email_team_settings" using btree ("teamId");

alter table "public"."email_team_settings"
    add constraint "email_team_settings_pkey" primary key using index "email_team_settings_pkey";

alter table "public"."email_team_settings"
    add constraint "email_team_settings_teamId_key" unique using index "email_team_settings_teamId_key";

alter table "public"."email_team_settings"
    add constraint "email_team_settings_teamId_fkey"
    foreign key ("teamId") references "public"."corretor_studio_teams"(id)
    on update cascade on delete cascade not valid;

alter table "public"."email_team_settings"
    validate constraint "email_team_settings_teamId_fkey";
