-- PAY-ABACATE-T011/T012: durable provider event inbox, dedupe and outbox.
-- The raw payload is retained only for the bounded retention policy attached to
-- the event record; payment retries are never inferred from this outbox.

CREATE TYPE "payment_provider_event_inbox_status" AS ENUM (
  'pending', 'processing', 'processed', 'failed', 'tombstoned'
);

CREATE TYPE "payment_provider_event_outbox_status" AS ENUM (
  'pending', 'processing', 'delivered', 'failed', 'dead_letter'
);

CREATE TABLE "payment_provider_event_dedupe" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "tombstone_until" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_event_dedupe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_event_dedupe_dedupe_key_key" UNIQUE ("dedupe_key"),
  CONSTRAINT "payment_provider_event_dedupe_scope_event_key" UNIQUE (
    "provider_key", "environment", "external_account_context", "event_id"
  )
);

CREATE INDEX "payment_provider_event_dedupe_tombstone_until_idx"
  ON "payment_provider_event_dedupe" ("tombstone_until");

CREATE TABLE "payment_provider_event_inbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "normalized_event" TEXT,
  "status" "payment_provider_event_inbox_status" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  "tombstone_until" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_provider_event_inbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_event_inbox_dedupe_key_key" UNIQUE ("dedupe_key"),
  CONSTRAINT "payment_provider_event_inbox_scope_event_key" UNIQUE (
    "provider_key", "environment", "external_account_context", "event_id"
  )
);

CREATE INDEX "payment_provider_event_inbox_status_received_at_idx"
  ON "payment_provider_event_inbox" ("status", "received_at" DESC);

CREATE TABLE "payment_provider_event_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inbox_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "payment_provider_event_outbox_status" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leased_until" TIMESTAMPTZ(6),
  "terminal_at" TIMESTAMPTZ(6),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_provider_event_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_event_outbox_inbox_event_key" UNIQUE ("inbox_id", "event_type"),
  CONSTRAINT "payment_provider_event_outbox_inbox_id_fkey"
    FOREIGN KEY ("inbox_id") REFERENCES "payment_provider_event_inbox"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payment_provider_event_outbox_status_next_attempt_at_idx"
  ON "payment_provider_event_outbox" ("status", "next_attempt_at");

ALTER TABLE "payment_provider_event_dedupe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_event_inbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_event_outbox" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "payment_provider_event_dedupe",
  "payment_provider_event_inbox",
  "payment_provider_event_outbox"
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  "payment_provider_event_dedupe",
  "payment_provider_event_inbox",
  "payment_provider_event_outbox"
TO service_role;

CREATE POLICY "payment_provider_event_dedupe_service_role_all"
  ON "payment_provider_event_dedupe" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_event_inbox_service_role_all"
  ON "payment_provider_event_inbox" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_event_outbox_service_role_all"
  ON "payment_provider_event_outbox" FOR ALL TO service_role USING (true) WITH CHECK (true);
