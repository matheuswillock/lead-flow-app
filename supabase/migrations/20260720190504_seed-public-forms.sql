-- Seed feature slug public-forms (Typeform-like public lead qualification forms)
INSERT INTO "public"."backoffice_features"
  ("id","slug","name","accessMode","defaultAccessLevel","betaEnabled","sortOrder","productSlug","parentId","isActive","createdAt","updatedAt")
SELECT gen_random_uuid(), 'public-forms', 'Formulários públicos', 'PUBLIC', 'FULL', true, 201, 'configuration',
  (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'integration'),
  true, now(), now()
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = 'public-forms';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id","featureId","principal","accessLevel","createdAt","updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'BACKOFFICE', 'FULL', now(), now()),
      (gen_random_uuid(), v_id, 'OPERATOR', 'FULL', now(), now())
    ON CONFLICT ("featureId","principal") DO NOTHING;
  END IF;
END $$;
