-- Catálogo canônico de features do backoffice (espelha prisma/seed-backoffice-products.ts).
-- Ambientes novos sem seed manual ficam com menu completo após db reset.
-- Tags Beta em email-settings / whatsapp-auto-responses vêm do grant no pai (FeatureAccessService).
-- Idempotente via ON CONFLICT DO NOTHING + UPDATE de flags.

-- ── CRM guarda-chuva ──────────────────────────────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel", "betaEnabled",
   "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'crm', 'CRM', 'PAID', 'FULL', false, false, 10, 'crm', NULL, true, now(), now()
)
ON CONFLICT ("slug") DO NOTHING;

-- ── CRM filhas (herdam settings do pai) ───────────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel", "betaEnabled",
   "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.slug, v.name, 'PAID', 'FULL', false, true, v.sort_order, v.product_slug,
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'), true, now(), now()
FROM (VALUES
  ('crm-dashboard',        'Dashboard',           20, 'crm'),
  ('crm-calendar',         'Calendário',          40, 'crm'),
  ('crm-performance',      'Performance',         50, 'crm'),
  ('crm-simulator',        'Simulador de Planos', 60, 'crm'),
  ('crm-wallet',           'Carteira',            95, 'crm')
) AS v(slug, name, sort_order, product_slug)
WHERE EXISTS (SELECT 1 FROM "public"."backoffice_features" WHERE "slug" = 'crm')
ON CONFLICT ("slug") DO NOTHING;

-- ── Email filhas (herdam settings do pai) ─────────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel", "betaEnabled",
   "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.slug, v.name, 'ADDON', 'FULL', false, true, v.sort_order, 'email',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'email'), true, now(), now()
FROM (VALUES
  ('email-templates',  'Templates',  110),
  ('email-contacts',   'Contatos',   120),
  ('email-campaigns',  'Campanhas',  130),
  ('email-history',    'Histórico',  140),
  ('email-analytics',  'Analytics',  150)
) AS v(slug, name, sort_order)
WHERE EXISTS (SELECT 1 FROM "public"."backoffice_features" WHERE "slug" = 'email')
ON CONFLICT ("slug") DO NOTHING;

-- ── Integração guarda-chuva ───────────────────────────────────────────────────
INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel", "betaEnabled",
   "inheritParentSettings", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'integration', 'Integração', 'PUBLIC', 'NONE', true, false, 200, NULL, NULL, true, now(), now()
)
ON CONFLICT ("slug") DO NOTHING;

-- ── Filhos com regras próprias (beta visual via pai) ──────────────────────────
UPDATE "public"."backoffice_features"
SET "inheritParentSettings" = false, "betaEnabled" = false, "updatedAt" = now()
WHERE "slug" IN ('email-settings', 'whatsapp-auto-responses', 'crm-lead-transfers');

-- ── Regras de acesso: integration (MASTER = FULL) ───────────────────────────
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'integration';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE',       'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;

-- ── Regras de acesso: CRM filhas (manager+) ─────────────────────────────────
DO $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  FOREACH v_slug IN ARRAY ARRAY[
    'crm', 'crm-dashboard', 'crm-calendar', 'crm-performance', 'crm-simulator', 'crm-wallet'
  ] LOOP
    SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = v_slug;
    IF v_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR',         'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'SDR',              'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END LOOP;
END $$;

-- ── Regras de acesso: Email filhas (manager+) ─────────────────────────────────
DO $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  FOREACH v_slug IN ARRAY ARRAY[
    'email', 'email-templates', 'email-contacts', 'email-campaigns', 'email-history', 'email-analytics'
  ] LOOP
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
