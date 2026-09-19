-- Idempotência (achado P1 do codex no PR #1204): esta migration já foi
-- aplicada em produção (consta em supabase_migrations.schema_migrations) —
-- editar o arquivo não a reexecuta lá. O ganho é para `db:migrate:reset:local`
-- e rerun de recuperação, que replayam o histórico inteiro do zero e paravam
-- em "type already exists" / "column already exists" num segundo replay. O
-- efeito final do schema é o mesmo; só as operações passaram a ser guardadas.
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'email_import_risk_level' and typnamespace = 'public'::regnamespace
  ) then
    create type "public"."email_import_risk_level" as enum ('low', 'medium', 'high');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'email_sending_health_status' and typnamespace = 'public'::regnamespace
  ) then
    create type "public"."email_sending_health_status" as enum ('healthy', 'warned', 'paused', 'suspended');
  end if;
end $$;

-- Equivalente idempotente ao rename→create→cast→drop original: mesmo efeito
-- final (enum ganha 'EMAIL_SENDING_HEALTH_CHANGED' ao final da lista de
-- valores), sem reconstruir o tipo inteiro. Mesmo padrão já usado em outras
-- migrations deste enum (ex.: 20260617005953_add-lead-transfer-activated-notification-type.sql).
alter type "public"."notification_type" add value if not exists 'EMAIL_SENDING_HEALTH_CHANGED';

alter table "public"."corretor_studio_email_contact_lists" add column if not exists "isQuarantined" boolean not null default false;

alter table "public"."corretor_studio_email_contact_lists" add column if not exists "quarantineReason" text;

alter table "public"."corretor_studio_email_contact_lists" add column if not exists "quarantineReleasedAt" timestamp(6) with time zone;

alter table "public"."corretor_studio_email_contact_lists" add column if not exists "quarantineReleasedBy" uuid;

alter table "public"."corretor_studio_email_contact_lists" add column if not exists "quarantinedAt" timestamp(6) with time zone;

alter table "public"."corretor_studio_email_import_jobs" add column if not exists "riskLevel" public.email_import_risk_level;

alter table "public"."corretor_studio_email_import_jobs" add column if not exists "validationCounts" jsonb;

alter table "public"."email_team_settings" add column if not exists "sendingHealthChangedAt" timestamp(6) with time zone;

alter table "public"."email_team_settings" add column if not exists "sendingHealthMetrics" jsonb;

alter table "public"."email_team_settings" add column if not exists "sendingHealthReason" text;

alter table "public"."email_team_settings" add column if not exists "sendingHealthStatus" public.email_sending_health_status not null default 'healthy'::public.email_sending_health_status;
