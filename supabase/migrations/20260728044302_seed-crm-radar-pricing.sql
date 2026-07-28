-- Seed idempotente: precificação CRM - Radar (somente trimestral CUSTOM 1200+990+990)
DO $$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT "id" INTO v_product_id
  FROM "public"."backoffice_products"
  WHERE "featureSlug" = 'crm'
    AND "name" = 'CRM - Radar'
  LIMIT 1;

  IF v_product_id IS NULL THEN
    v_product_id := gen_random_uuid();
    INSERT INTO "public"."backoffice_products" (
      "id",
      "name",
      "featureSlug",
      "description",
      "type",
      "billingMode",
      "priceMonthly",
      "priceQuarterly",
      "priceSemiannual",
      "priceAnnual",
      "priceLifetime",
      "isDefault",
      "isActive",
      "createdAt",
      "updatedAt"
    ) VALUES (
      v_product_id,
      'CRM - Radar',
      'crm',
      'Precificação trimestral CRM para Radar — à vista ou cronograma 1x R$1.200 + 2x R$990.',
      'PLAN',
      'RECURRING',
      NULL,
      1060.00,
      NULL,
      NULL,
      NULL,
      false,
      true,
      now(),
      now()
    );
  ELSE
    UPDATE "public"."backoffice_products"
    SET
      "description" = 'Precificação trimestral CRM para Radar — à vista ou cronograma 1x R$1.200 + 2x R$990.',
      "billingMode" = 'RECURRING',
      "type" = 'PLAN',
      "priceMonthly" = NULL,
      "priceQuarterly" = 1060.00,
      "priceSemiannual" = NULL,
      "priceAnnual" = NULL,
      "priceLifetime" = NULL,
      "isDefault" = false,
      "isActive" = true,
      "updatedAt" = now()
    WHERE "id" = v_product_id;
  END IF;

  INSERT INTO "public"."backoffice_product_payment_rules" (
    "id",
    "productId",
    "paymentMethod",
    "billingCycle",
    "price",
    "canInstallment",
    "maxInstallments",
    "installmentSplitMode",
    "installmentSchedule"
  )
  VALUES (
    gen_random_uuid(),
    v_product_id,
    'PIX',
    'quarterly',
    1060.00,
    false,
    1,
    'EQUAL',
    '[]'::jsonb
  )
  ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO UPDATE
  SET
    "price" = EXCLUDED."price",
    "canInstallment" = EXCLUDED."canInstallment",
    "maxInstallments" = EXCLUDED."maxInstallments",
    "installmentSplitMode" = EXCLUDED."installmentSplitMode",
    "installmentSchedule" = EXCLUDED."installmentSchedule";

  INSERT INTO "public"."backoffice_product_payment_rules" (
    "id",
    "productId",
    "paymentMethod",
    "billingCycle",
    "price",
    "canInstallment",
    "maxInstallments",
    "installmentSplitMode",
    "installmentSchedule"
  )
  VALUES (
    gen_random_uuid(),
    v_product_id,
    'CREDIT_CARD',
    'quarterly',
    3180.00,
    true,
    3,
    'CUSTOM',
    '[1200,990,990]'::jsonb
  )
  ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO UPDATE
  SET
    "price" = EXCLUDED."price",
    "canInstallment" = EXCLUDED."canInstallment",
    "maxInstallments" = EXCLUDED."maxInstallments",
    "installmentSplitMode" = EXCLUDED."installmentSplitMode",
    "installmentSchedule" = EXCLUDED."installmentSchedule";
END $$;
