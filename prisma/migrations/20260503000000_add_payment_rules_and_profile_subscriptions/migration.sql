DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_payment_method') THEN
    CREATE TYPE backoffice_payment_method AS ENUM ('PIX', 'CREDIT_CARD');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS backoffice_product_payment_rules (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "paymentMethod" backoffice_payment_method NOT NULL,
  "billingCycle" backoffice_adhesion_billing_cycle NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  "canInstallment" BOOLEAN NOT NULL DEFAULT false,
  "maxInstallments" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT backoffice_product_payment_rules_pkey PRIMARY KEY (id),
  CONSTRAINT backoffice_product_payment_rules_productId_fkey
    FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON DELETE CASCADE,
  CONSTRAINT backoffice_product_payment_rules_unique
    UNIQUE ("productId", "paymentMethod", "billingCycle")
);

CREATE INDEX IF NOT EXISTS backoffice_product_payment_rules_productId_idx
  ON backoffice_product_payment_rules ("productId");

ALTER TABLE backoffice_adhesions
  ADD COLUMN IF NOT EXISTS "asaasInstallmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER;

ALTER TABLE backoffice_adhesions
  DROP CONSTRAINT IF EXISTS backoffice_adhesions_asaasInstallmentId_key;

ALTER TABLE backoffice_adhesions
  ADD CONSTRAINT backoffice_adhesions_asaasInstallmentId_key UNIQUE ("asaasInstallmentId");
