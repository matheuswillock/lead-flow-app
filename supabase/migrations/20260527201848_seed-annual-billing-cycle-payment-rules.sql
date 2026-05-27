-- Insert payment rules for annual cycle on CRM product (PIX)
-- Separated from the enum migration due to Postgres restriction:
-- new enum values cannot be used in the same transaction as ALTER TYPE ADD VALUE.
INSERT INTO "backoffice_product_payment_rules"
  ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
SELECT
  gen_random_uuid(),
  id,
  'PIX',
  'annual',
  69.90,
  false,
  1
FROM "backoffice_products" WHERE slug = 'crm'
ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;

-- Insert payment rules for annual cycle on CRM product (CREDIT_CARD)
INSERT INTO "backoffice_product_payment_rules"
  ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
SELECT
  gen_random_uuid(),
  id,
  'CREDIT_CARD',
  'annual',
  79.90,
  true,
  12
FROM "backoffice_products" WHERE slug = 'crm'
ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;
