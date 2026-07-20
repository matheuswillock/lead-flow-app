-- Deduplicação atômica de entregas outbound (retry outbox sem duplicar WhatsApp)

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_bot_outbound_delivery_status" AS ENUM ('processing', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."backoffice_bot_outbound_delivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotencyKey" TEXT NOT NULL,
  "status" "public"."backoffice_bot_outbound_delivery_status" NOT NULL DEFAULT 'processing',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_outbound_delivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_bot_outbound_delivery_idempotencyKey_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "backoffice_bot_outbound_delivery_status_updated_idx"
  ON "public"."backoffice_bot_outbound_delivery" ("status", "updatedAt");
