-- Garante que a coluna e o valor do enum existem antes do backfill (idempotentes).
ALTER TABLE "backoffice_products"
  ADD COLUMN IF NOT EXISTS "priceAnnual" DECIMAL(10,2);

ALTER TYPE "backoffice_adhesion_billing_cycle" ADD VALUE IF NOT EXISTS 'annual';

-- Backfill rígido de priceAnnual para produtos recorrentes já existentes.
-- Idempotente: só atualiza registros com priceAnnual nulo.

UPDATE "backoffice_products"
SET "priceAnnual" = 69.90
WHERE "slug" = 'crm'
  AND "billingMode" = 'RECURRING'
  AND "priceAnnual" IS NULL;

UPDATE "backoffice_products"
SET "priceAnnual" = 29.90
WHERE "slug" = 'extra-team'
  AND "billingMode" = 'RECURRING'
  AND "priceAnnual" IS NULL;

UPDATE "backoffice_products"
SET "priceAnnual" = 19.90
WHERE "slug" = 'extra-user'
  AND "billingMode" = 'RECURRING'
  AND "priceAnnual" IS NULL;

UPDATE "backoffice_products"
SET "priceAnnual" = 29.90
WHERE "slug" = 'email'
  AND "billingMode" = 'RECURRING'
  AND "priceAnnual" IS NULL;
