-- Detach public-forms from CRM: top-level sibling feature (no parent, no CRM product)
UPDATE "public"."backoffice_features"
SET
  "parentId" = NULL,
  "productSlug" = NULL,
  "sortOrder" = 98,
  "updatedAt" = now()
WHERE "slug" = 'public-forms';
