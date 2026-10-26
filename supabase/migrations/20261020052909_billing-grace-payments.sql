CREATE TABLE IF NOT EXISTS "public"."billing_grace_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "team_id" UUID,
  "subscription_id" UUID,
  "cycle" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "effective_price_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_environment" TEXT NOT NULL,
  "provider_session_id" UUID,
  "provider_attempt_id" UUID,
  "provider_external_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payment_instructions" JSONB,
  "quote_expires_at" TIMESTAMPTZ(6),
  "confirmed_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_grace_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_grace_payments_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "billing_grace_payments_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_grace_payments_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "billing_grace_payments_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "public"."corretor_studio_profile_subscriptions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "billing_grace_payments_account_status_idx"
  ON "public"."billing_grace_payments" ("account_id", "status");
CREATE INDEX IF NOT EXISTS "billing_grace_payments_provider_attempt_idx"
  ON "public"."billing_grace_payments" ("provider_attempt_id");
CREATE INDEX IF NOT EXISTS "billing_grace_payments_provider_external_idx"
  ON "public"."billing_grace_payments" ("provider_external_id");

ALTER TABLE "public"."billing_grace_payments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."billing_grace_payments" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."billing_grace_payments" TO service_role;

CREATE POLICY "billing_grace_payments_service_role_only"
  ON "public"."billing_grace_payments"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
