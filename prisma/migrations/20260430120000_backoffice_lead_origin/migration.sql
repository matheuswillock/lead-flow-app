-- Backoffice lead origin tracking for Meta webhook ingestion.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_lead_origin') THEN
    CREATE TYPE backoffice_lead_origin AS ENUM (
      'manual',
      'webhook_meta'
    );
  END IF;
END$$;

ALTER TABLE backoffice_leads
  ADD COLUMN IF NOT EXISTS origin backoffice_lead_origin NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourceExternalId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceWebhookEventId" UUID;

CREATE INDEX IF NOT EXISTS backoffice_leads_origin_idx
  ON backoffice_leads (origin);

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_leads_source_external_id_key
  ON backoffice_leads ("sourceExternalId");

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_leads_source_webhook_event_id_key
  ON backoffice_leads ("sourceWebhookEventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'backoffice_leads_source_webhook_event_id_fkey'
  ) THEN
    ALTER TABLE backoffice_leads
      ADD CONSTRAINT backoffice_leads_source_webhook_event_id_fkey
      FOREIGN KEY ("sourceWebhookEventId")
      REFERENCES backoffice_webhook_events(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END$$;
