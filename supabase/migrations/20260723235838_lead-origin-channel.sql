-- D1: Lead.originChannel/originMetadata — schema only, no behavior change (Fase D).
--
-- Generated via `bun run db:migrate:from-prisma -- lead-origin-channel` and manually
-- trimmed: the raw `supabase db diff` output also contained unrelated FK-constraint
-- and index rename noise for dozens of pre-existing tables (naming-convention drift
-- between hand-written migrations and Prisma's default naming, same pre-existing
-- drift documented in 20260722173729_team-radar-segments.sql), which is out of
-- scope here.
--
-- New columns are nullable with no DB-level default: existing leads stay NULL
-- (see the paired 20260724000031_lead-origin-channel-backfill.sql for why no
-- backfill is attempted) and the application-level default of "manual" is only
-- applied going forward, starting in D2.

create type "public"."LeadOriginChannel" as enum ('manual', 'csv_import', 'public_form', 'legacy_public_widget', 'studio_webhook', 'meta_webhook', 'whatsapp_manual');

alter table "public"."corretor_studio_leads" add column if not exists "originChannel" public."LeadOriginChannel";

alter table "public"."corretor_studio_leads" add column if not exists "originMetadata" jsonb;
