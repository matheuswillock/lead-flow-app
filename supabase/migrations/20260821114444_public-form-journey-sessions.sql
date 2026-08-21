-- Criada com `bun run db:migrate:new public-form-journey-sessions`.
-- O diff da CLI recriava `PublicFormMetricType` inteiro (rename + swap + drop),
-- o que reescreve a coluna de uma tabela de eventos que só cresce. Como a
-- mudança é aditiva, `ADD VALUE IF NOT EXISTS` entrega o mesmo resultado sem
-- tocar nos dados. O restante do diff era drift não relacionado e foi descartado.
--
-- Nomes físicos conferidos contra os `@@map`/`@map` de prisma/schema.prisma:
--   PublicFormJourneySession -> corretor_studio_public_form_journey_sessions
--   PublicFormJourneyState   -> public_form_journey_state
--   PublicForm               -> corretor_studio_public_forms
--   PublicFormPublication    -> corretor_studio_public_form_publications

-- Taxonomia de jornada do contrato v1. `form_abandoned` e `form_resumed` são
-- exclusivamente server-side: o cron e o consumer os emitem, `/events` recusa.
alter type "public"."PublicFormMetricType" add value if not exists 'page_viewed';
alter type "public"."PublicFormMetricType" add value if not exists 'page_advanced';
alter type "public"."PublicFormMetricType" add value if not exists 'page_returned';
alter type "public"."PublicFormMetricType" add value if not exists 'question_focused';
alter type "public"."PublicFormMetricType" add value if not exists 'form_submit_attempted';
alter type "public"."PublicFormMetricType" add value if not exists 'form_validation_failed';
alter type "public"."PublicFormMetricType" add value if not exists 'form_exit_intent';
alter type "public"."PublicFormMetricType" add value if not exists 'form_abandoned';
alter type "public"."PublicFormMetricType" add value if not exists 'form_resumed';

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'public_form_journey_state'
  ) then
    create type "public"."public_form_journey_state" as enum ('active', 'abandoned', 'completed');
  end if;
end $$;

create table if not exists "public"."corretor_studio_public_form_journey_sessions" (
  "id" uuid not null,
  "formId" uuid not null,
  "publicationId" uuid not null,
  "visitorSessionId" text not null,
  "state" public.public_form_journey_state not null default 'active'::public.public_form_journey_state,
  "startedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "lastActivityAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "currentPageId" uuid,
  "currentPageIndex" integer,
  "lastExitIntentAt" timestamp(6) with time zone,
  "lastAbandonedAt" timestamp(6) with time zone,
  "lastResumedAt" timestamp(6) with time zone,
  "abandonmentCount" integer not null default 0,
  "submittedAt" timestamp(6) with time zone,
  "completedAt" timestamp(6) with time zone,
  "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone not null
);

create unique index if not exists "corretor_studio_public_form_journey_sessions_pkey"
  on public.corretor_studio_public_form_journey_sessions using btree (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_public_form_journey_sessions_pkey'
  ) then
    alter table "public"."corretor_studio_public_form_journey_sessions"
      add constraint "corretor_studio_public_form_journey_sessions_pkey"
      primary key using index "corretor_studio_public_form_journey_sessions_pkey";
  end if;
end $$;

-- Uma sessão de jornada por visitante em cada publicação: é esta chave que
-- torna a atualização por evento idempotente.
create unique index if not exists "corretor_studio_public_form_journey_sessions_publicationId__key"
  on public.corretor_studio_public_form_journey_sessions using btree ("publicationId", "visitorSessionId");

-- Suporta o claim do cron de abandono (state + inatividade).
create index if not exists "corretor_studio_public_form_journey_sessions_state_lastActi_idx"
  on public.corretor_studio_public_form_journey_sessions using btree (state, "lastActivityAt");

create index if not exists "corretor_studio_public_form_journey_sessions_formId_state_idx"
  on public.corretor_studio_public_form_journey_sessions using btree ("formId", state);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_public_form_journey_sessions_formId_fkey'
  ) then
    alter table "public"."corretor_studio_public_form_journey_sessions"
      add constraint "corretor_studio_public_form_journey_sessions_formId_fkey"
      foreign key ("formId") references public.corretor_studio_public_forms(id)
      on update cascade on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_public_form_journey_sessions_publicationId_fkey'
  ) then
    alter table "public"."corretor_studio_public_form_journey_sessions"
      add constraint "corretor_studio_public_form_journey_sessions_publicationId_fkey"
      foreign key ("publicationId") references public.corretor_studio_public_form_publications(id)
      on update cascade on delete cascade;
  end if;
end $$;

-- Acesso exclusivo pelo service_role (backend), consistente com as demais
-- tabelas do domínio public-forms (ver 20260718215353_enable-public-typeform-forms-rls.sql).
alter table "public"."corretor_studio_public_form_journey_sessions" enable row level security;

revoke all on table "public"."corretor_studio_public_form_journey_sessions" from "anon", "authenticated";
grant all on table "public"."corretor_studio_public_form_journey_sessions" to "service_role";

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'corretor_studio_public_form_journey_sessions'
      and policyname = 'public_form_journey_sessions_service_role_all'
  ) then
    execute 'create policy public_form_journey_sessions_service_role_all
      on public.corretor_studio_public_form_journey_sessions for all to service_role
      using (true) with check (true)';
  end if;
end $$;
