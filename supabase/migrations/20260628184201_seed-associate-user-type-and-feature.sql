-- Seed: profile user type associate + feature crm-backoffice-associados
-- Idempotent via ON CONFLICT DO NOTHING.

INSERT INTO "public"."profile_user_types"
  ("id", "slug", "name", "description", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'associate',
    'Associado',
    'Conta parceira patrocinada; opera CRM autônomo com backoffice do patrocinador responsável pela subida na operadora.',
    now(),
    now()
  )
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-backoffice-associados',
  'Associados',
  'PAID',
  'FULL',
  false,
  36,
  'crm',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'crm-backoffice-associados';
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
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;
