-- CDP add-on: produto, feature guarda-chuva e regras de acesso/pagamento
-- Idempotente via ON CONFLICT DO NOTHING.

INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'cdp',
  'CDP',
  'CDP — perfis unificados, segmentos e timeline para campanhas de e-mail.',
  'ADDON',
  'RECURRING',
  29.90,
  29.90,
  29.90,
  29.90,
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'cdp',
  'CDP',
  'ADDON',
  'FULL',
  true,
  180,
  'cdp',
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'cdp';

  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'BACKOFFICE',       'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT "id" INTO v_product_id
  FROM "public"."backoffice_products"
  WHERE "slug" = 'cdp';

  IF v_product_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    VALUES
      (gen_random_uuid(), v_product_id, 'PIX', 'monthly',    29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'quarterly',  29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'semiannual', 29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'annual',     29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'monthly',    29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'quarterly',  29.90, true,  3),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'semiannual', 29.90, true,  6),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'annual',     29.90, true,  12)
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;
  END IF;
END $$;
