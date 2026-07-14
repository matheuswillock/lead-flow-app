create type "public"."AuditAction" as enum ('CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE');

create type "public"."AuditEntityType" as enum ('PROFILE', 'TEAM', 'TEAM_MEMBER');

create table "public"."corretor_studio_audit_logs" (
    "id" uuid not null,
    "entityType" public."AuditEntityType" not null,
    "entityId" uuid not null,
    "action" public."AuditAction" not null,
    "actorProfileId" uuid,
    "before" jsonb,
    "after" jsonb,
    "metadata" jsonb,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX corretor_studio_audit_logs_pkey ON public.corretor_studio_audit_logs USING btree (id);

CREATE INDEX corretor_studio_audit_logs_action_idx ON public.corretor_studio_audit_logs USING btree (action);

CREATE INDEX "corretor_studio_audit_logs_actorProfileId_idx" ON public.corretor_studio_audit_logs USING btree ("actorProfileId");

CREATE INDEX "corretor_studio_audit_logs_entityType_entityId_createdAt_idx" ON public.corretor_studio_audit_logs USING btree ("entityType", "entityId", "createdAt" DESC);

alter table "public"."corretor_studio_audit_logs" add constraint "corretor_studio_audit_logs_pkey" PRIMARY KEY using index "corretor_studio_audit_logs_pkey";

alter table "public"."corretor_studio_audit_logs" add constraint "corretor_studio_audit_logs_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_audit_logs" validate constraint "corretor_studio_audit_logs_actorProfileId_fkey";

grant references on table "public"."corretor_studio_audit_logs" to "anon";

grant trigger on table "public"."corretor_studio_audit_logs" to "anon";

grant truncate on table "public"."corretor_studio_audit_logs" to "anon";

grant references on table "public"."corretor_studio_audit_logs" to "authenticated";

grant trigger on table "public"."corretor_studio_audit_logs" to "authenticated";

grant truncate on table "public"."corretor_studio_audit_logs" to "authenticated";

grant references on table "public"."corretor_studio_audit_logs" to "service_role";

grant trigger on table "public"."corretor_studio_audit_logs" to "service_role";

grant truncate on table "public"."corretor_studio_audit_logs" to "service_role";
