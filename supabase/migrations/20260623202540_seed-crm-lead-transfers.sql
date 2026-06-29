-- Feature crm-lead-transfers (Transferências)
-- Fonte canônica: migration (não duplicar em prisma/seed-backoffice-products.ts).
-- Idempotente via ON CONFLICT DO NOTHING.

-- Pré-requisito: produto e feature guarda-chuva CRM (ambientes locais sem seed).
INSERT INTO "public"."backoffice_products"
  ("id", "slug", "name", "description", "type", "billingMode",
   "priceMonthly", "priceQuarterly", "priceSemiannual", "priceAnnual",
   "priceLifetime", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'crm',
  'CRM',
  'Plano CRM — acesso completo ao módulo de gestão de leads.',
  'PLAN',
  'RECURRING',
  89.90,
  79.90,
  69.90,
  69.90,
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
  'crm',
  'CRM',
  'PAID',
  'FULL',
  false,
  10,
  'crm',
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT ("slug") DO NOTHING;

-- Feature filha: busca de leads transferidos (Master / Manager / Backoffice)
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-lead-transfers',
  'Transferências',
  'PAID',
  'FULL',
  false,
  35,
  'crm',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'crm-lead-transfers';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;
