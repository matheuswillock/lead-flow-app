INSERT INTO "public"."backoffice_features"
  ("id","slug","name","accessMode","defaultAccessLevel","betaEnabled","sortOrder","productSlug","parentId","isActive","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  'studio-bot',
  'Bethânia',
  'ADDON',
  'FULL',
  false,
  180,
  'crm',
  NULL,
  true,
  now(),
  now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'studio-bot';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id","featureId","principal","accessLevel","createdAt","updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId","principal") DO NOTHING;
  END IF;
END $$;
