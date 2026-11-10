-- SLUGs dedicados para as funcionalidades do hub de Integrações.
-- Hoje "webhooks", "api-catalog" e "lead-form" (Formulário de Captação de
-- Leads) viviam todas atrás do guarda-chuva `integration`, e "pixel" atrás de
-- `radar` — impossível gerenciar beta/regras de acesso de cada uma
-- separadamente no backoffice. Espelha prisma/seed-backoffice-products.ts.
--
-- `inheritParentSettings = true` em todas: accessMode/accessRules/beta
-- continuam resolvidos a partir do pai (FeatureAccessService), então
-- hasAccess(novoSlug) dá o mesmo resultado que hasAccess(slugDoPai) hoje —
-- zero regressão de acesso. Idempotente via ON CONFLICT DO NOTHING.

-- ── Filhas do guarda-chuva "integration" ───────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug",
   "parentId", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.slug, v.name, 'PUBLIC', 'NONE', false, true, v.sort_order, NULL,
  parent."id", true, now(), now()
FROM "public"."backoffice_features" parent,
  (VALUES
    ('webhooks',    'Webhooks',                         201),
    ('api-catalog', 'Catálogo de API',                  202),
    ('lead-form',   'Formulário de Captação de Leads',  203)
  ) AS v(slug, name, sort_order)
WHERE parent."slug" = 'integration'
ON CONFLICT ("slug") DO NOTHING;

-- ── Pixel (filha do guarda-chuva "radar") ──────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "inheritParentSettings", "sortOrder", "productSlug",
   "parentId", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'pixel', 'Pixel', 'ADDON', 'FULL', false, true, 181, 'radar',
  parent."id", true, now(), now()
FROM "public"."backoffice_features" parent
WHERE parent."slug" = 'radar'
ON CONFLICT ("slug") DO NOTHING;

-- ── Regras de acesso: mesmas do pai respectivo ─────────────────────────────
DO $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  FOREACH v_slug IN ARRAY ARRAY['webhooks', 'api-catalog', 'lead-form'] LOOP
    SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = v_slug;
    IF v_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE',       'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END LOOP;
END $$;

DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'pixel';
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
