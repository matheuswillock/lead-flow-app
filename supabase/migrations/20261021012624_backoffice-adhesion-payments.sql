-- Pagamento PIX da "Nova adesão" do backoffice cobrado pelo provider de pagamento (Abacate).
-- Mesmo padrão de billing_grace_payments: tabela só acessível por service_role, com RLS.
-- A adesão ainda não tem conta, então a sessão do provider usa adhesion_id como tenant.
-- A chave de idempotência vale por adesão (unique adhesion_id + idempotency_key).
-- Rollback: DROP TABLE "public"."backoffice_adhesion_payments" (sem dados de outras tabelas).

CREATE TABLE IF NOT EXISTS "public"."backoffice_adhesion_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "adhesion_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_environment" TEXT NOT NULL,
  "provider_session_id" UUID,
  "provider_attempt_id" UUID,
  "provider_external_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  -- Pagador congelado no momento da cobrança: a conta é criada a partir destes dados, nunca dos
  -- campos mutáveis da adesão. status: pending | confirmed | completed | failed | superseded | review.
  "payer_name" TEXT NOT NULL,
  "payer_email" TEXT NOT NULL,
  "payer_tax_id" TEXT NOT NULL,
  "payer_cellphone" TEXT NOT NULL,
  "payment_instructions" JSONB,
  "confirmed_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backoffice_adhesion_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_adhesion_payments_adhesion_id_fkey"
    FOREIGN KEY ("adhesion_id") REFERENCES "public"."backoffice_adhesions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_adhesion_payments_adhesion_idempotency_key"
  ON "public"."backoffice_adhesion_payments" ("adhesion_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "backoffice_adhesion_payments_adhesion_status_idx"
  ON "public"."backoffice_adhesion_payments" ("adhesion_id", "status");
CREATE INDEX IF NOT EXISTS "backoffice_adhesion_payments_provider_attempt_idx"
  ON "public"."backoffice_adhesion_payments" ("provider_attempt_id");
CREATE INDEX IF NOT EXISTS "backoffice_adhesion_payments_provider_external_idx"
  ON "public"."backoffice_adhesion_payments" ("provider_external_id");

ALTER TABLE "public"."backoffice_adhesion_payments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."backoffice_adhesion_payments" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."backoffice_adhesion_payments" TO service_role;

DROP POLICY IF EXISTS "backoffice_adhesion_payments_service_role_only"
  ON "public"."backoffice_adhesion_payments";
CREATE POLICY "backoffice_adhesion_payments_service_role_only"
  ON "public"."backoffice_adhesion_payments"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
