create table if not exists "public"."short_links" (
  "id"        uuid                     not null default gen_random_uuid(),
  "code"      character varying(16)    not null,
  "targetUrl" text                     not null,
  "expiresAt" timestamp(6) with time zone,
  "createdAt" timestamp(6) with time zone not null default now(),
  "updatedAt" timestamp(6) with time zone not null default now()
);

alter table "public"."short_links"
  add constraint "short_links_pkey" primary key ("id");

create unique index if not exists "short_links_code_key"      on public.short_links using btree (code);
create unique index if not exists "short_links_targetUrl_key" on public.short_links using btree ("targetUrl");
create        index if not exists "short_links_code_idx"      on public.short_links using btree (code);

grant select, insert, update, delete on table "public"."short_links" to "authenticated";
grant select, insert, update, delete on table "public"."short_links" to "service_role";
