-- Promote public-forms, radar and integration to top-level umbrella features
-- (same level as CRM / email), so they can host their own child features.
-- Idempotent: safe to re-run.

UPDATE "public"."backoffice_features"
SET
  "parentId" = NULL,
  "inheritParentSettings" = false,
  "billedSeparately" = false,
  "updatedAt" = now()
WHERE "slug" IN ('public-forms', 'radar', 'integration')
  AND (
    "parentId" IS NOT NULL
    OR "inheritParentSettings" = true
    OR "billedSeparately" = true
  );

-- public-forms: keep as standalone product umbrella (no CRM product slug)
UPDATE "public"."backoffice_features"
SET
  "productSlug" = NULL,
  "sortOrder" = 190,
  "updatedAt" = now()
WHERE "slug" = 'public-forms';

-- radar: own product umbrella
UPDATE "public"."backoffice_features"
SET
  "productSlug" = 'radar',
  "sortOrder" = 180,
  "updatedAt" = now()
WHERE "slug" = 'radar';

-- integration: platform umbrella (no product slug)
UPDATE "public"."backoffice_features"
SET
  "productSlug" = NULL,
  "sortOrder" = 200,
  "updatedAt" = now()
WHERE "slug" = 'integration';
