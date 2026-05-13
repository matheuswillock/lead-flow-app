-- Add "configuration" umbrella feature (PUBLIC/NONE + betaEnabled)
-- Access is granted exclusively via beta grants in the backoffice.
INSERT INTO "backoffice_features" (
  "id", "slug", "name", "accessMode", "defaultAccessLevel",
  "betaEnabled", "isActive", "sortOrder", "productSlug", "parentId", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'configuration',
  'Configuração',
  'PUBLIC',
  'NONE',
  true,
  true,
  200,
  NULL,
  NULL,
  NOW(),
  NOW()
) ON CONFLICT ("slug") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "betaEnabled" = EXCLUDED."betaEnabled",
  "isActive"    = EXCLUDED."isActive";
