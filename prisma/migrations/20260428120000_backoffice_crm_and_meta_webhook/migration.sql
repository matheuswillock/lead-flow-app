-- Backoffice CRM + Meta Webhook
-- Tabelas e enums exclusivos do módulo de backoffice.
-- Mantém isolamento de dados em relação ao módulo principal (Lead, LeadStatus etc.).

-- ENUMS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_lead_status') THEN
    CREATE TYPE backoffice_lead_status AS ENUM (
      'new_opportunity',
      'scheduled',
      'no_show',
      'lost',
      'implementation',
      'finalized'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_webhook_source') THEN
    CREATE TYPE backoffice_webhook_source AS ENUM ('meta');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_webhook_event_status') THEN
    CREATE TYPE backoffice_webhook_event_status AS ENUM ('received', 'processed', 'failed');
  END IF;
END$$;

-- BACKOFFICE LEADS

CREATE TABLE IF NOT EXISTS backoffice_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status backoffice_lead_status NOT NULL DEFAULT 'new_opportunity',
  "statusEnteredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdByProfileId" UUID REFERENCES profiles(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backoffice_leads_status_idx
  ON backoffice_leads (status);

CREATE INDEX IF NOT EXISTS backoffice_leads_created_by_profile_id_idx
  ON backoffice_leads ("createdByProfileId");

CREATE INDEX IF NOT EXISTS backoffice_leads_email_idx
  ON backoffice_leads (email);

-- BACKOFFICE WEBHOOK EVENTS (recepção bruta de webhooks externos, ex: Meta Lead Ads)

CREATE TABLE IF NOT EXISTS backoffice_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source backoffice_webhook_source NOT NULL,
  "eventType" TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  status backoffice_webhook_event_status NOT NULL DEFAULT 'received',
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS backoffice_webhook_events_source_received_at_idx
  ON backoffice_webhook_events (source, "receivedAt" DESC);

CREATE INDEX IF NOT EXISTS backoffice_webhook_events_status_idx
  ON backoffice_webhook_events (status);
