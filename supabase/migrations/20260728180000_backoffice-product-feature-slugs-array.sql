-- Estágio 4: adiciona featureSlugs[] e backfill a partir de featureSlug singular
ALTER TABLE "public"."backoffice_products"
  ADD COLUMN IF NOT EXISTS "featureSlugs" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "public"."backoffice_products"
SET "featureSlugs" = ARRAY["featureSlug"]
WHERE cardinality("featureSlugs") = 0
  AND "featureSlug" IS NOT NULL
  AND btrim("featureSlug") <> '';

CREATE INDEX IF NOT EXISTS "backoffice_products_feature_slugs_gin_idx"
  ON "public"."backoffice_products" USING GIN ("featureSlugs");
