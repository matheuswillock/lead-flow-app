create type "public"."subscription_lifecycle_event" as enum ('contracted', 'renewed', 'plan_changed', 'addon_purchased', 'overdue', 'reduced', 'cut', 'restored', 'free_access_granted', 'level_transition');

  create table "public"."corretor_studio_subscription_state_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "profileId" uuid not null,
    "capturedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "schemaVersion" text not null,
    "payload" jsonb not null
      );

alter table "public"."corretor_studio_subscription_change_logs" add column "eventType" public.subscription_lifecycle_event;

CREATE UNIQUE INDEX corretor_studio_subscription_state_snapshots_pkey ON public.corretor_studio_subscription_state_snapshots USING btree (id);

CREATE INDEX subscription_change_logs_event_type_idx ON public.corretor_studio_subscription_change_logs USING btree ("eventType");

CREATE INDEX subscription_state_snapshots_captured_at_idx ON public.corretor_studio_subscription_state_snapshots USING btree ("capturedAt");

CREATE INDEX subscription_state_snapshots_profile_id_idx ON public.corretor_studio_subscription_state_snapshots USING btree ("profileId");

alter table "public"."corretor_studio_subscription_state_snapshots" add constraint "corretor_studio_subscription_state_snapshots_pkey" PRIMARY KEY using index "corretor_studio_subscription_state_snapshots_pkey";

-- S4 (achado C3 da auditoria) / 20 — Assinaturas — Backend E1: as duas
-- tabelas de trilha de assinatura passam a ser append-only de verdade.
-- REVOKE UPDATE/DELETE por si só não bloqueia a conexão do Prisma — em
-- ambiente local e no pooler do Supabase o role "postgres" tem privilégio
-- efetivo de superusuário/dono, que ignora GRANT/REVOKE (só RLS e triggers
-- continuam valendo). Por isso a trava real é um trigger BEFORE
-- UPDATE/DELETE incondicional — o único precedente de "prevent" no repo
-- (public.prevent_delete_default_email_contact_list, migration
-- 20260603150001) é condicional a uma flag; este é sempre-bloqueia, por
-- desenho (não existe UPDATE/DELETE legítimo em log/snapshot de auditoria).
create or replace function public.prevent_subscription_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only — UPDATE/DELETE are not allowed (S4, 20 — Assinaturas — Backend E1)',
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
end;
$$;

drop trigger if exists trg_prevent_mutation_subscription_state_snapshots
  on "public"."corretor_studio_subscription_state_snapshots";

create trigger trg_prevent_mutation_subscription_state_snapshots
  before update or delete on "public"."corretor_studio_subscription_state_snapshots"
  for each row execute function public.prevent_subscription_audit_mutation();

drop trigger if exists trg_prevent_mutation_subscription_change_logs
  on "public"."corretor_studio_subscription_change_logs";

create trigger trg_prevent_mutation_subscription_change_logs
  before update or delete on "public"."corretor_studio_subscription_change_logs"
  for each row execute function public.prevent_subscription_audit_mutation();
