-- Ledger interno de cobrancas (M12): visao de negocio provider-neutra por cima da camada de execucao
-- (sessoes, tentativas, identidades). payment_charge_events e append-only: sem UPDATE/DELETE para
-- os papeis de app (trigger bloqueia UPDATE; service_role so recebe SELECT/INSERT).
-- Valores dos CHECK espelham lib/payments/charge-status.ts (CHARGE_STATUSES) e lib/payments/types.ts
-- (CHARGE_PURPOSES, CHARGE_SOURCES).
-- Rollback: DROP TABLE "public"."payment_charge_events"; DROP TABLE "public"."payment_charges";
--           DROP FUNCTION "public"."payment_charge_events_block_update"();

CREATE TABLE IF NOT EXISTS "public"."payment_charges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" UUID NOT NULL,
  "subscription_id" UUID,
  "purpose" TEXT NOT NULL,
  "purpose_ref_id" TEXT,
  "status" TEXT NOT NULL,
  "raw_status" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "method" TEXT,
  "cycle_key" TEXT,
  "due_date" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "provider" TEXT NOT NULL,
  "provider_environment" TEXT NOT NULL,
  "provider_context" TEXT NOT NULL,
  "provider_session_id" UUID,
  "provider_attempt_id" UUID,
  "provider_external_id" TEXT,
  "payment_instructions" JSONB,
  "idempotency_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_charges_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_charges_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "public"."corretor_studio_profile_subscriptions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "payment_charges_amount_cents_check" CHECK ("amount_cents" >= 0),
  CONSTRAINT "payment_charges_status_check" CHECK ("status" IN
    ('PENDING','CONFIRMED','COMPLETED','FAILED','EXPIRED','REFUNDED','REVIEW','CANCELED')),
  CONSTRAINT "payment_charges_purpose_check" CHECK ("purpose" IN
    ('SUBSCRIPTION_RENEWAL','ADD_USER','ADD_TEAM','CREDITS','CHANGE_ORDER','BACKOFFICE_CHARGE',
     'ADHESION','GRACE','PLATFORM_PURCHASE')),
  CONSTRAINT "payment_charges_source_check" CHECK ("source" IN ('ROUTER','ASAAS_SHADOW','MIRROR'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_charges_profile_idempotency_key"
  ON "public"."payment_charges" ("profile_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_charges_subscription_cycle_key"
  ON "public"."payment_charges" ("subscription_id", "cycle_key")
  WHERE "subscription_id" IS NOT NULL AND "cycle_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_charges_provider_external_key"
  ON "public"."payment_charges" ("provider", "provider_environment", "provider_context", "provider_external_id")
  WHERE "provider_external_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payment_charges_profile_status_idx"
  ON "public"."payment_charges" ("profile_id", "status");
CREATE INDEX IF NOT EXISTS "payment_charges_provider_attempt_idx"
  ON "public"."payment_charges" ("provider_attempt_id");
CREATE INDEX IF NOT EXISTS "payment_charges_purpose_ref_idx"
  ON "public"."payment_charges" ("purpose", "purpose_ref_id");

CREATE TABLE IF NOT EXISTS "public"."payment_charge_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "charge_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "raw_status" TEXT,
  "actor" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_charge_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_charge_events_charge_id_fkey"
    FOREIGN KEY ("charge_id") REFERENCES "public"."payment_charges"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_charge_events_to_status_check" CHECK ("to_status" IN
    ('PENDING','CONFIRMED','COMPLETED','FAILED','EXPIRED','REFUNDED','REVIEW','CANCELED')),
  CONSTRAINT "payment_charge_events_from_status_check" CHECK ("from_status" IS NULL OR "from_status" IN
    ('PENDING','CONFIRMED','COMPLETED','FAILED','EXPIRED','REFUNDED','REVIEW','CANCELED'))
);

CREATE INDEX IF NOT EXISTS "payment_charge_events_charge_idx"
  ON "public"."payment_charge_events" ("charge_id", "occurred_at");

CREATE OR REPLACE FUNCTION "public"."payment_charge_events_block_update"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment_charge_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS "payment_charge_events_no_update" ON "public"."payment_charge_events";
CREATE TRIGGER "payment_charge_events_no_update"
  BEFORE UPDATE ON "public"."payment_charge_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."payment_charge_events_block_update"();

ALTER TABLE "public"."payment_charges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."payment_charges" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."payment_charges" TO service_role;
DROP POLICY IF EXISTS "payment_charges_service_role_only" ON "public"."payment_charges";
CREATE POLICY "payment_charges_service_role_only"
  ON "public"."payment_charges" FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "public"."payment_charge_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."payment_charge_events" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "public"."payment_charge_events" FROM service_role;
GRANT SELECT, INSERT ON TABLE "public"."payment_charge_events" TO service_role;
DROP POLICY IF EXISTS "payment_charge_events_service_role_read" ON "public"."payment_charge_events";
CREATE POLICY "payment_charge_events_service_role_read"
  ON "public"."payment_charge_events" FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "payment_charge_events_service_role_insert" ON "public"."payment_charge_events";
CREATE POLICY "payment_charge_events_service_role_insert"
  ON "public"."payment_charge_events" FOR INSERT TO service_role WITH CHECK (true);
