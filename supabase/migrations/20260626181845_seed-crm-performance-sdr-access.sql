-- Grant SDR principal FULL access to crm-performance feature
DO $$
DECLARE v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id FROM "public"."backoffice_features" WHERE "slug" = 'crm-performance';
  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'SDR', 'FULL', now(), now())
    ON CONFLICT ("featureId", "principal")
    DO UPDATE SET "accessLevel" = 'FULL', "updatedAt" = now();
  END IF;
END $$;
