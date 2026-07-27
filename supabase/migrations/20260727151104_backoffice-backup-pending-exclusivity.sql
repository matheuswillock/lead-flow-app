-- At most one backup may be `pending` at a time (atomic exclusivity across cron/manual).
-- Stale pending rows are expired by the app before claiming; this index is the hard guard.
CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_database_backups_one_pending_uidx"
  ON "public"."backoffice_database_backups" ((true))
  WHERE "status" = 'pending';
