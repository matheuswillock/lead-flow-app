-- Backoffice CRM operational roles, lead assignment and local scheduling.

ALTER TABLE backoffice_users
  ADD COLUMN IF NOT EXISTS "isSdr" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isCloser" BOOLEAN NOT NULL DEFAULT true;

UPDATE backoffice_users
SET
  "isSdr" = true,
  "isCloser" = true
WHERE "isSdr" IS DISTINCT FROM true
   OR "isCloser" IS DISTINCT FROM true;

ALTER TABLE backoffice_leads
  ADD COLUMN IF NOT EXISTS "sdrBackofficeUserId" UUID,
  ADD COLUMN IF NOT EXISTS "closerBackofficeUserId" UUID,
  ADD COLUMN IF NOT EXISTS "meetingDate" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "meetingTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "meetingNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;

CREATE INDEX IF NOT EXISTS backoffice_users_is_sdr_idx
  ON backoffice_users ("isSdr");

CREATE INDEX IF NOT EXISTS backoffice_users_is_closer_idx
  ON backoffice_users ("isCloser");

CREATE INDEX IF NOT EXISTS backoffice_leads_sdr_user_id_idx
  ON backoffice_leads ("sdrBackofficeUserId");

CREATE INDEX IF NOT EXISTS backoffice_leads_closer_user_id_idx
  ON backoffice_leads ("closerBackofficeUserId");

CREATE INDEX IF NOT EXISTS backoffice_leads_meeting_date_idx
  ON backoffice_leads ("meetingDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'backoffice_leads_sdr_backoffice_user_id_fkey'
  ) THEN
    ALTER TABLE backoffice_leads
      ADD CONSTRAINT backoffice_leads_sdr_backoffice_user_id_fkey
      FOREIGN KEY ("sdrBackofficeUserId")
      REFERENCES backoffice_users(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'backoffice_leads_closer_backoffice_user_id_fkey'
  ) THEN
    ALTER TABLE backoffice_leads
      ADD CONSTRAINT backoffice_leads_closer_backoffice_user_id_fkey
      FOREIGN KEY ("closerBackofficeUserId")
      REFERENCES backoffice_users(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END$$;
