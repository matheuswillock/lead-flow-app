-- C6 (Hardening e fechamento) — Task 1: dedupe leftover duplicate indexes on the 5
-- corretor_studio_radar_* tables.
--
-- These duplicates were created out-of-band on the remote database at some point
-- during the original CDP build (a raw `prisma db push`/`migrate dev`, never
-- captured as a tracked migration) — they carry Prisma's default long-form names
-- (e.g. `..._teamId_type_normalizedValue_ke`), while the equivalent, intentionally
-- short-named index that IS tracked in migrations (from 20260623192000_cdp-core-
-- schema.sql, renamed cdp→radar in-place by 20260718220125_radar-rename-physical-
-- schema.sql) already exists on the same table/columns. Confirmed via a read-only
-- `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN (...)` against the
-- remote project (via Supabase MCP) — for every pair below, `indexdef` is
-- byte-identical except for the index name, so they are structurally redundant
-- twins: Postgres can only ever use one of the two for any given query, and the
-- second one only adds write overhead + storage with no query-plan benefit. Local
-- dev never had these duplicates (local only replays tracked migrations), so this
-- migration is a set of `DROP INDEX IF EXISTS` — safe no-ops locally, real cleanup
-- once applied to remote.
--
-- One structurally similar-looking pair was deliberately EXCLUDED from this dedupe:
-- `corretor_studio_radar_profiles_teamId_lastSeenAt_idx` (Prisma-default, DESC,
-- implicit NULLS FIRST) vs. `corretor_studio_radar_profiles_team_last_seen_idx`
-- (tracked, explicit DESC NULLS LAST) — same columns, but NOT the same index
-- semantics for NULL lastSeenAt values. Dropping either could change which rows
-- with a NULL lastSeenAt come first/last for a query that doesn't pin NULLS
-- ordering explicitly. Left both in place; resolving this asymmetry is a
-- deliberate follow-up, not a "redundant index" cleanup.

-- corretor_studio_radar_channel_consents
DROP INDEX IF EXISTS "corretor_studio_radar_channel_consents_profileId_channel_key";
DROP INDEX IF EXISTS "corretor_studio_radar_channel_consents_teamId_channel_status_id";

-- corretor_studio_radar_events
DROP INDEX IF EXISTS "corretor_studio_radar_events_profileId_occurredAt_idx";
DROP INDEX IF EXISTS "corretor_studio_radar_events_teamId_eventType_occurredAt_idx";
DROP INDEX IF EXISTS "corretor_studio_radar_events_teamId_sourceType_sourceId_event_k";

-- corretor_studio_radar_identities
DROP INDEX IF EXISTS "corretor_studio_radar_identities_profileId_type_idx";
DROP INDEX IF EXISTS "corretor_studio_radar_identities_teamId_type_normalizedValue_ke";

-- corretor_studio_radar_profiles
DROP INDEX IF EXISTS "corretor_studio_radar_profiles_teamId_normalizedPrimaryDocume_i";
DROP INDEX IF EXISTS "corretor_studio_radar_profiles_teamId_normalizedPrimaryEmail_id";
DROP INDEX IF EXISTS "corretor_studio_radar_profiles_teamId_normalizedPhone_normali_k";

-- corretor_studio_radar_source_links
DROP INDEX IF EXISTS "corretor_studio_radar_source_links_profileId_sourceType_idx";
DROP INDEX IF EXISTS "corretor_studio_radar_source_links_teamId_sourceType_sourceId_k";
