-- Feature crm-multiskill-transfers (Transferências MultiSkill — exclusiva conta Bruno)
-- Idempotente via ON CONFLICT DO NOTHING.

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'crm-multiskill-transfers',
  'MultiSkill',
  'PAID',
  'NONE',
  true,
  37,
  'crm',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  true,
  now(),
  now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  v_feature_id uuid;
  v_profile_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'crm-multiskill-transfers';

  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'MANAGER',          'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'BACKOFFICE',       'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;

  SELECT "id" INTO v_profile_id
  FROM "public"."corretor_studio_profiles"
  WHERE "email" = 'bruno@onsidemarketing.com.br'
  LIMIT 1;

  IF v_feature_id IS NOT NULL AND v_profile_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_grants"
      ("id", "featureId", "profileId", "grantType", "accessLevel", "isActive", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, v_profile_id, 'BETA', 'FULL', true, now(), now())
    ON CONFLICT ("featureId", "profileId", "grantType") DO NOTHING;
  END IF;
END $$;
