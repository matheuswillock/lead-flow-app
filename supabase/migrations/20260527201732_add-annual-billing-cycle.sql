-- Add 'annual' value to backoffice_adhesion_billing_cycle enum
-- NOTE: ALTER TYPE ADD VALUE cannot be used in the same transaction as statements
-- that reference the new value. The payment rules INSERT is in the next migration.
ALTER TYPE "backoffice_adhesion_billing_cycle" ADD VALUE IF NOT EXISTS 'annual';

-- Add priceAnnual column to backoffice_products
ALTER TABLE "backoffice_products"
  ADD COLUMN IF NOT EXISTS "priceAnnual" DECIMAL(10,2);
