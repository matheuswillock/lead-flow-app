-- Backfill rígido das regras anuais para produtos recorrentes.
-- Idempotente via ON CONFLICT DO NOTHING.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'backoffice_adhesion_billing_cycle'
      AND e.enumlabel = 'annual'
  ) THEN
    -- CRM: PIX anual fixo
    INSERT INTO "backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    SELECT
      gen_random_uuid(),
      p.id,
      'PIX',
      'annual',
      69.90,
      false,
      1
    FROM "backoffice_products" p
    WHERE p.slug = 'crm'
      AND p."billingMode" = 'RECURRING'
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;

    -- CRM: cartão anual fixo
    INSERT INTO "backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    SELECT
      gen_random_uuid(),
      p.id,
      'CREDIT_CARD',
      'annual',
      79.90,
      true,
      12
    FROM "backoffice_products" p
    WHERE p.slug = 'crm'
      AND p."billingMode" = 'RECURRING'
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;

    -- Add-ons recorrentes: PIX anual = preço mensal do produto
    INSERT INTO "backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    SELECT
      gen_random_uuid(),
      p.id,
      'PIX',
      'annual',
      p."priceMonthly",
      false,
      1
    FROM "backoffice_products" p
    WHERE p.slug IN ('extra-team', 'extra-user', 'email')
      AND p."billingMode" = 'RECURRING'
      AND p."priceMonthly" IS NOT NULL
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;

    -- Add-ons recorrentes: cartão anual = preço mensal do produto
    INSERT INTO "backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    SELECT
      gen_random_uuid(),
      p.id,
      'CREDIT_CARD',
      'annual',
      p."priceMonthly",
      true,
      12
    FROM "backoffice_products" p
    WHERE p.slug IN ('extra-team', 'extra-user', 'email')
      AND p."billingMode" = 'RECURRING'
      AND p."priceMonthly" IS NOT NULL
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;
  END IF;
END $$;
