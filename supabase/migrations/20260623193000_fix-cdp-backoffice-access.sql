-- CDP: conceder FULL ao principal BACKOFFICE
UPDATE "public"."backoffice_feature_access_rules"
SET "accessLevel" = 'FULL', "updatedAt" = now()
WHERE "featureId" = (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'cdp')
  AND "principal" = 'BACKOFFICE';
