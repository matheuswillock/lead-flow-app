-- Seed idempotente: precificação CRM - RADAR - GERENCIADO
-- R$ 10.000 em cobrança única (PIX ou cartão; cartão em até 4x iguais), acesso por 4 meses
-- (ciclo quadrimester = R$ 2.500/mês EQUAL × 4). Libera crm, radar, email e public-forms.
-- Contexto: bug do dialog de precificação impede o cadastro pela UI
-- (vault: bugs/2026-08-30-dialog-precificacao-valor-monetario.md).
DO $$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT "id" INTO v_product_id
  FROM "public"."backoffice_products"
  WHERE "name" = 'CRM - RADAR - GERENCIADO'
  LIMIT 1;

  IF v_product_id IS NULL THEN
    v_product_id := gen_random_uuid();
    INSERT INTO "public"."backoffice_products" (
      "id",
      "name",
      "featureSlugs",
      "description",
      "type",
      "billingMode",
      "priceMonthly",
      "priceQuarterly",
      "priceQuadrimester",
      "priceSemiannual",
      "priceAnnual",
      "priceLifetime",
      "isDefault",
      "isActive",
      "createdAt",
      "updatedAt"
    ) VALUES (
      v_product_id,
      'CRM - RADAR - GERENCIADO',
      ARRAY['crm','radar','email','public-forms'],
      'Plano gerenciado quadrimestral — R$ 10.000 em cobrança única (cartão em até 4x iguais); libera CRM, Radar, E-mails e Formulários.',
      'PLAN',
      'RECURRING',
      NULL,
      NULL,
      2500.00,
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
      "featureSlugs" = ARRAY['crm','radar','email','public-forms'],
      "description" = 'Plano gerenciado quadrimestral — R$ 10.000 em cobrança única (cartão em até 4x iguais); libera CRM, Radar, E-mails e Formulários.',
      "billingMode" = 'RECURRING',
      "type" = 'PLAN',
      "priceMonthly" = NULL,
      "priceQuarterly" = NULL,
      "priceQuadrimester" = 2500.00,
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
    'quadrimester',
    2500.00,
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
    'quadrimester',
    2500.00,
    true,
    4,
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
END $$;
