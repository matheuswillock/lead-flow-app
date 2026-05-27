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
