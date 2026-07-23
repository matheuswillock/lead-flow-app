-- C4: TeamRadarSegment — custom dynamic segments (D9).
--
-- Generated via `bun run db:migrate:from-prisma -- team-radar-segments` and manually
-- trimmed: the raw `supabase db diff` output also contained unrelated FK-constraint
-- rename noise for dozens of pre-existing tables (naming-convention drift between
-- hand-written migrations and Prisma's default FK naming), which is out of scope here.

create table if not exists "public"."corretor_studio_radar_segments" (
  "id" uuid not null default gen_random_uuid(),
  "teamId" uuid not null,
  "createdBy" uuid not null,
  "name" text not null,
  "description" text,
  "rulesJson" jsonb not null,
  "isSystem" boolean not null default false,
  "isActive" boolean not null default true,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  constraint "corretor_studio_radar_segments_pkey" primary key ("id")
);

create unique index if not exists "corretor_studio_radar_segments_teamId_name_key"
  on "public"."corretor_studio_radar_segments" using btree ("teamId", "name");

create index if not exists "corretor_studio_radar_segments_teamId_isActive_idx"
  on "public"."corretor_studio_radar_segments" using btree ("teamId", "isActive");

do $$ begin
  alter table "public"."corretor_studio_radar_segments"
    add constraint "corretor_studio_radar_segments_teamId_fkey"
    foreign key ("teamId") references "public"."corretor_studio_teams"("id") on update cascade on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table "public"."corretor_studio_radar_segments"
    add constraint "corretor_studio_radar_segments_createdBy_fkey"
    foreign key ("createdBy") references "public"."corretor_studio_profiles"("id") on update cascade on delete cascade;
exception
  when duplicate_object then null;
end $$;

grant references, trigger, truncate on table "public"."corretor_studio_radar_segments" to "anon";
grant references, trigger, truncate on table "public"."corretor_studio_radar_segments" to "authenticated";
grant references, trigger, truncate on table "public"."corretor_studio_radar_segments" to "service_role";
