-- Estágio 4: remove coluna legada featureSlug após migração para featureSlugs[]
DROP INDEX IF EXISTS "backoffice_products_feature_slug_idx";
DROP INDEX IF EXISTS "backoffice_products_feature_slug_is_default_idx";

ALTER TABLE "public"."backoffice_products"
  DROP COLUMN IF EXISTS "featureSlug";
