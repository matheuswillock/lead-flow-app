-- BACKOFFICE WEBHOOK TOKEN HISTORY
-- Tokens are append-only. Rotation marks the previous active token as replaced
-- and inserts a new active token. The partial unique index enforces one active
-- token per webhook source.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_webhook_token_status') THEN
    CREATE TYPE backoffice_webhook_token_status AS ENUM ('active', 'replaced', 'expired');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_webhook_token_expiry_mode') THEN
    CREATE TYPE backoffice_webhook_token_expiry_mode AS ENUM ('hours_24', 'months_6', 'indeterminate');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS backoffice_webhook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source backoffice_webhook_source NOT NULL,
  "tokenHash" text NOT NULL,
  "tokenCipher" text NOT NULL,
  "tokenPreview" text NOT NULL,
  status backoffice_webhook_token_status NOT NULL DEFAULT 'active',
  "expiryMode" backoffice_webhook_token_expiry_mode NOT NULL DEFAULT 'indeterminate',
  "expiresAt" timestamptz,
  "lastUsedAt" timestamptz,
  "generatedByBackofficeUserId" uuid NOT NULL,
  "generatedByEmailSnapshot" text NOT NULL,
  "generatedAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backoffice_webhook_tokens_generated_by_fkey
    FOREIGN KEY ("generatedByBackofficeUserId")
    REFERENCES backoffice_users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS backoffice_webhook_tokens_source_status_idx
  ON backoffice_webhook_tokens (source, status);

CREATE INDEX IF NOT EXISTS backoffice_webhook_tokens_generated_at_idx
  ON backoffice_webhook_tokens ("generatedAt" DESC);

CREATE INDEX IF NOT EXISTS backoffice_webhook_tokens_expires_at_idx
  ON backoffice_webhook_tokens ("expiresAt");

CREATE INDEX IF NOT EXISTS backoffice_webhook_tokens_generated_by_idx
  ON backoffice_webhook_tokens ("generatedByBackofficeUserId");

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_webhook_tokens_one_active_per_source_idx
  ON backoffice_webhook_tokens (source)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS backoffice_webhook_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source backoffice_webhook_source NOT NULL,
  method text NOT NULL,
  endpoint text NOT NULL,
  "statusCode" integer NOT NULL,
  "resultType" text NOT NULL,
  "requestPayload" jsonb,
  "responsePayload" jsonb,
  "errorMessage" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backoffice_webhook_request_logs_source_created_at_idx
  ON backoffice_webhook_request_logs (source, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS backoffice_webhook_request_logs_status_code_idx
  ON backoffice_webhook_request_logs ("statusCode");
