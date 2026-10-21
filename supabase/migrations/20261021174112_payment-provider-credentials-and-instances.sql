-- M11 (PAY-CRED-T001/T002/T003): várias instâncias por provider/ambiente, nome de exibição,
-- configurações não secretas e credenciais cifradas por instância.
-- A cifra é AES-256-GCM feita na aplicação (lib/payment-provider/credential-cipher.ts);
-- o banco só vê texto cifrado. Tabela acessível apenas por service_role, com RLS.
-- Rollback: DROP TABLE "public"."payment_provider_credentials"; recriar o índice único
-- (provider_key, environment); DROP das colunas display_name e settings.

ALTER TABLE "public"."payment_provider_configs"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

-- Preenche o nome das linhas semeadas antes desta migration.
UPDATE "public"."payment_provider_configs"
SET "display_name" = CASE "provider_key"::text
  WHEN 'ABACATE_PAY' THEN 'Abacate Pay'
  WHEN 'ASAAS' THEN 'Asaas'
  ELSE "provider_key"::text
END
WHERE "display_name" = '';

-- A unicidade passa a incluir a conta externa: duas contas do mesmo provider são duas instâncias.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_configs_provider_env_context_key"
  ON "public"."payment_provider_configs" ("provider_key", "environment", "external_account_context");
-- A unicidade antiga é uma CONSTRAINT (20261018120000), não um índice avulso: DROP INDEX falharia.
ALTER TABLE "public"."payment_provider_configs"
  DROP CONSTRAINT IF EXISTS "payment_provider_configs_provider_environment_key";

CREATE TABLE IF NOT EXISTS "public"."payment_provider_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "config_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value_ciphertext" TEXT NOT NULL,
  "key_id" TEXT NOT NULL,
  "last4" TEXT,
  "fingerprint" TEXT NOT NULL,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_credentials_config_id_fkey"
    FOREIGN KEY ("config_id") REFERENCES "public"."payment_provider_configs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_credentials_config_key_key"
  ON "public"."payment_provider_credentials" ("config_id", "key");

ALTER TABLE "public"."payment_provider_credentials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."payment_provider_credentials" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."payment_provider_credentials" TO service_role;

DROP POLICY IF EXISTS "payment_provider_credentials_service_role_only"
  ON "public"."payment_provider_credentials";
CREATE POLICY "payment_provider_credentials_service_role_only"
  ON "public"."payment_provider_credentials"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
