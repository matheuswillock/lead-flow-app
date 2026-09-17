create type "public"."team_form_domain_status" as enum ('pending', 'verified', 'failed');

  create table "public"."corretor_studio_team_form_domains" (
    "id" uuid not null,
    "teamId" uuid not null,
    "hostname" text not null,
    "status" public.team_form_domain_status not null default 'pending'::public.team_form_domain_status,
    "vercelDomainId" text,
    "verifiedAt" timestamp(6) with time zone,
    "lastCheckedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

CREATE UNIQUE INDEX corretor_studio_team_form_domains_hostname_key ON public.corretor_studio_team_form_domains USING btree (hostname);

CREATE UNIQUE INDEX corretor_studio_team_form_domains_pkey ON public.corretor_studio_team_form_domains USING btree (id);

CREATE INDEX "corretor_studio_team_form_domains_status_lastCheckedAt_idx" ON public.corretor_studio_team_form_domains USING btree (status, "lastCheckedAt");

CREATE UNIQUE INDEX "corretor_studio_team_form_domains_teamId_key" ON public.corretor_studio_team_form_domains USING btree ("teamId");

alter table "public"."corretor_studio_team_form_domains" add constraint "corretor_studio_team_form_domains_pkey" PRIMARY KEY using index "corretor_studio_team_form_domains_pkey";

alter table "public"."corretor_studio_team_form_domains" add constraint "corretor_studio_team_form_domains_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_form_domains" validate constraint "corretor_studio_team_form_domains_teamId_fkey";
