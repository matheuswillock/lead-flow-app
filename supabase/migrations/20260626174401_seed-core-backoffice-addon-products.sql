-- Produtos add-on core do backoffice (ambientes locais sem seed manual).
-- Fonte canônica espelhada em prisma/seed-backoffice-products.ts
-- Idempotente via ON CONFLICT DO NOTHING.

-- crm-lifetime
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'crm-lifetime',
  'CRM Vitalício',
  'Plano CRM com acesso vitalício — pagamento único, sem mensalidade.',
  'PLAN',
  'LIFETIME',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- extra-team
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'extra-team',
  'Time Adicional',
  'Adiciona um time extra à conta.',
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

-- extra-user
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'extra-user',
  'Usuário Adicional',
  'Adiciona um usuário operador extra à conta.',
  'ADDON',
  'RECURRING',
  19.90,
  19.90,
  19.90,
  19.90,
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- email
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'email',
  'Email',
  'Módulo de email para campanhas, contatos, templates e analytics.',
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

-- Features CRM filhas (dependem de crm guarda-chuva existente)
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-time',
  'Time',
  'PAID',
  'FULL',
  false,
  true,
  70,
  'crm',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
WHERE EXISTS (SELECT 1 FROM "public"."backoffice_features" WHERE "slug" = 'crm')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-time-manage-teams',
  'Gerenciar Times',
  'PAID',
  'FULL',
  false,
  true,
  80,
  'extra-team',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
WHERE EXISTS (SELECT 1 FROM "public"."backoffice_features" WHERE "slug" = 'crm')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-time-manage-users',
  'Gerenciar Usuários',
  'PAID',
  'FULL',
  false,
  true,
  90,
  'extra-user',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
WHERE EXISTS (SELECT 1 FROM "public"."backoffice_features" WHERE "slug" = 'crm')
ON CONFLICT ("slug") DO NOTHING;

-- Email guarda-chuva
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'email',
  'Email',
  'ADDON',
  'FULL',
  true,
  false,
  100,
  'email',
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- Access rules: crm-time-manage-teams
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'crm-time-manage-teams';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;

-- Access rules: crm-time-manage-users
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'crm-time-manage-users';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'FULL', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;
