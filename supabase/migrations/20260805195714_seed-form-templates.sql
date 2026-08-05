-- Feature form-templates (Templates de formulário no backoffice)
-- Idempotente via ON CONFLICT DO NOTHING.

INSERT INTO "public"."backoffice_features"
  ("id", "slug", "name", "accessMode", "defaultAccessLevel",
   "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'form-templates',
  'Templates de formulário',
  'PUBLIC',
  'FULL',
  false,
  195,
  NULL,
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'integration'),
  true,
  now(),
  now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'form-templates';
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
