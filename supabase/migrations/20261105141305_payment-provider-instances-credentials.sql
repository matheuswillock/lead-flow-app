ALTER TABLE "public"."payment_provider_configs"
  DROP CONSTRAINT IF EXISTS "payment_provider_configs_provider_environment_key";

ALTER TABLE "public"."payment_provider_configs"
  ADD CONSTRAINT "payment_provider_configs_provider_environment_account_key"
  UNIQUE ("provider_key", "environment", "external_account_context");

ALTER TABLE "public"."payment_provider_configs"
  ADD COLUMN "display_name" TEXT;

CREATE TABLE "public"."payment_provider_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "config_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value_ciphertext" TEXT NOT NULL,
  "key_id" TEXT NOT NULL,
  "last4" TEXT,
  "fingerprint" TEXT NOT NULL,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_provider_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_credentials_config_id_fkey"
    FOREIGN KEY ("config_id") REFERENCES "public"."payment_provider_configs"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "payment_provider_credentials_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "public"."corretor_studio_profiles"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "payment_provider_credentials_config_key_key" UNIQUE ("config_id", "key")
);

CREATE INDEX "payment_provider_credentials_updated_by_idx"
  ON "public"."payment_provider_credentials" ("updated_by");

ALTER TABLE "public"."payment_provider_credentials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."payment_provider_credentials" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."payment_provider_credentials" TO service_role;
CREATE POLICY "payment_provider_credentials_service_role_only"
  ON "public"."payment_provider_credentials"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS 'PAYMENT_PROVIDER_CONFIG';
