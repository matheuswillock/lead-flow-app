-- D4: allow a RadarProfile to exist without a phone ("email-only" profile).
--
-- normalizedPhone/displayPhone were required (NOT NULL) — a contact that
-- only ever appears via e-mail (EmailContact list entry, or a Resend
-- webhook event) with no corresponding CRM Lead had no way to get a Radar
-- profile at all; the sync paths silently skipped it.
--
-- Safe/lossless: neither column has a @default, so no DROP DEFAULT is
-- needed (unlike 20260624134849_lead-status-nullable-for-drafts.sql, which
-- is the precedent for this same DROP NOT NULL pattern).
--
-- The existing unique index corretor_studio_radar_profiles_team_phone_name_key
-- on (teamId, normalizedPhone, normalizedName) needs no change: it was
-- created as a plain CREATE UNIQUE INDEX with no NULLS NOT DISTINCT clause,
-- and Postgres defaults to NULLS DISTINCT — so multiple rows with
-- normalizedPhone IS NULL under the same (teamId, normalizedName) are
-- already allowed. Dedup for email-only profiles happens through
-- RadarIdentity's own unique key ([teamId, type, normalizedValue]) instead.

ALTER TABLE "public"."corretor_studio_radar_profiles"
  ALTER COLUMN "normalizedPhone" DROP NOT NULL,
  ALTER COLUMN "displayPhone" DROP NOT NULL;
