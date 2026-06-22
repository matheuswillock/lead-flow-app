-- ─────────────────────────────────────────────────────────────────────────────
-- WhatsApp add-on: produto, feature guarda-chuva e regras de acesso/pagamento
-- Idempotente via ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Produto ──────────────────────────────────────────────────────────────────
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'whatsapp',
  'WhatsApp',
  'Módulo WhatsApp — inbox, conversas e envio de mensagens via Evolution API.',
  'ADDON',
  'RECURRING',
  39.90,
  34.90,
  29.90,
  29.90,
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- 2. Feature guarda-chuva ──────────────────────────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'whatsapp',
  'WhatsApp',
  'ADDON',
  'FULL',
  true,
  170,
  'whatsapp',
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- 3. Regras de acesso ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'whatsapp';

  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'OPERATOR',         'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'SDR',              'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CLOSER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;

-- 4. Regras de pagamento ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT "id" INTO v_product_id
  FROM "public"."backoffice_products"
  WHERE "slug" = 'whatsapp';

  IF v_product_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_product_payment_rules"
      ("id", "productId", "paymentMethod", "billingCycle", "price", "canInstallment", "maxInstallments")
    VALUES
      -- PIX
      (gen_random_uuid(), v_product_id, 'PIX', 'monthly',    39.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'quarterly',  34.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'semiannual', 29.90, false, 1),
      (gen_random_uuid(), v_product_id, 'PIX', 'annual',     29.90, false, 1),
      -- Cartão de crédito (com acréscimo)
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'monthly',    45.90, false, 1),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'quarterly',  39.90, true,  3),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'semiannual', 34.90, true,  6),
      (gen_random_uuid(), v_product_id, 'CREDIT_CARD', 'annual',     34.90, true,  12)
    ON CONFLICT ("productId", "paymentMethod", "billingCycle") DO NOTHING;
  END IF;
END $$;
