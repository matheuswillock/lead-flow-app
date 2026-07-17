-- Register the email-unsubscribe feature as a child of the email parent feature
INSERT INTO "public"."backoffice_features" (
  "id", "slug", "name", "accessMode", "defaultAccessLevel",
  "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'email-unsubscribe',
  'Descadastro',
  'ADDON',
  'FULL',
  false,
  155,
  'email',
  parent."id",
  true,
  now(),
  now()
FROM "public"."backoffice_features" parent
WHERE parent."slug" = 'email'
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'email-unsubscribe';

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
