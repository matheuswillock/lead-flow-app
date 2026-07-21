-- Move public-forms feature from Integração to CRM
UPDATE "public"."backoffice_features"
SET
  "parentId" = (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = 'crm'),
  "productSlug" = 'crm',
  "sortOrder" = 97,
  "updatedAt" = now()
WHERE "slug" = 'public-forms';
