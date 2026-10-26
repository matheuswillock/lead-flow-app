create type "team_landing_domain_status" as enum ('pending', 'verified', 'failed');

create type "landing_page_status" as enum ('draft', 'published', 'archived');

create table "corretor_studio_team_landing_domains" (
  "id" uuid not null default gen_random_uuid(),
  "teamId" uuid not null,
  "hostname" text not null,
  "status" "team_landing_domain_status" not null default 'pending',
  "vercelDomainId" text,
  "verifiedAt" timestamptz(6),
  "lastCheckedAt" timestamptz(6),
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  constraint "corretor_studio_team_landing_domains_pkey" primary key ("id")
);

create unique index "corretor_studio_team_landing_domains_teamId_key"
  on "corretor_studio_team_landing_domains" ("teamId");
create unique index "corretor_studio_team_landing_domains_hostname_key"
  on "corretor_studio_team_landing_domains" ("hostname");
create index "corretor_studio_team_landing_domains_status_lastCheckedAt_idx"
  on "corretor_studio_team_landing_domains" ("status", "lastCheckedAt");

create table "corretor_studio_landing_pages" (
  "id" uuid not null default gen_random_uuid(),
  "teamId" uuid not null,
  "publicFormId" uuid not null,
  "createdById" uuid not null,
  "publicId" uuid not null default gen_random_uuid(),
  "name" text not null,
  "status" "landing_page_status" not null default 'draft',
  "templateSlug" text not null,
  "content" jsonb not null default '{}',
  "offer" jsonb not null default '{}',
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  constraint "corretor_studio_landing_pages_pkey" primary key ("id")
);

create unique index "corretor_studio_landing_pages_publicId_key"
  on "corretor_studio_landing_pages" ("publicId");
create index "corretor_studio_landing_pages_teamId_status_updatedAt_idx"
  on "corretor_studio_landing_pages" ("teamId", "status", "updatedAt" desc);
create index "corretor_studio_landing_pages_publicFormId_idx"
  on "corretor_studio_landing_pages" ("publicFormId");

create table "corretor_studio_landing_page_publications" (
  "id" uuid not null default gen_random_uuid(),
  "landingPageId" uuid not null,
  "publishedById" uuid not null,
  "version" integer not null,
  "snapshot" jsonb not null,
  "publishedAt" timestamptz(6) not null default current_timestamp,
  "endedAt" timestamptz(6),
  constraint "corretor_studio_landing_page_publications_pkey" primary key ("id")
);

create unique index "corretor_studio_landing_page_publications_landingPageId_version_key"
  on "corretor_studio_landing_page_publications" ("landingPageId", "version");
create index "corretor_studio_landing_page_publications_landingPageId_endedAt_publishedAt_idx"
  on "corretor_studio_landing_page_publications" ("landingPageId", "endedAt", "publishedAt" desc);

alter table "corretor_studio_team_landing_domains"
  add constraint "corretor_studio_team_landing_domains_teamId_fkey"
  foreign key ("teamId") references "corretor_studio_teams" ("id") on delete cascade on update cascade;
alter table "corretor_studio_landing_pages"
  add constraint "corretor_studio_landing_pages_teamId_fkey"
  foreign key ("teamId") references "corretor_studio_teams" ("id") on delete cascade on update cascade;
alter table "corretor_studio_landing_pages"
  add constraint "corretor_studio_landing_pages_publicFormId_fkey"
  foreign key ("publicFormId") references "corretor_studio_public_forms" ("id") on delete restrict on update cascade;
alter table "corretor_studio_landing_pages"
  add constraint "corretor_studio_landing_pages_createdById_fkey"
  foreign key ("createdById") references "corretor_studio_profiles" ("id") on delete restrict on update cascade;
alter table "corretor_studio_landing_page_publications"
  add constraint "corretor_studio_landing_page_publications_landingPageId_fkey"
  foreign key ("landingPageId") references "corretor_studio_landing_pages" ("id") on delete cascade on update cascade;
alter table "corretor_studio_landing_page_publications"
  add constraint "corretor_studio_landing_page_publications_publishedById_fkey"
  foreign key ("publishedById") references "corretor_studio_profiles" ("id") on delete restrict on update cascade;
