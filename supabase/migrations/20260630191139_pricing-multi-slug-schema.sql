-- Pricing multi-slug: featureSlug (non-unique), isDefault, billedSeparately, adhesion.productId

-- 1. Backoffice products: slug → featureSlug, remove unique, add isDefault
ALTER TABLE "public"."backoffice_products" RENAME COLUMN "slug" TO "featureSlug";

ALTER TABLE "public"."backoffice_products" DROP CONSTRAINT IF EXISTS "backoffice_products_slug_key";

ALTER TABLE "public"."backoffice_products"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "backoffice_products_feature_slug_idx"
  ON "public"."backoffice_products" ("featureSlug");

CREATE INDEX IF NOT EXISTS "backoffice_products_feature_slug_is_default_idx"
  ON "public"."backoffice_products" ("featureSlug", "isDefault");

DROP INDEX IF EXISTS "backoffice_products_slug_idx";

-- Mark all existing products as default (continuity for adhesion/webhooks)
UPDATE "public"."backoffice_products"
SET "isDefault" = true
WHERE "isDefault" = false;

-- 2. Backoffice features: remove FK to products, add billedSeparately
ALTER TABLE "public"."backoffice_features" DROP CONSTRAINT IF EXISTS "backoffice_features_productSlug_fkey";

ALTER TABLE "public"."backoffice_features"
  ADD COLUMN IF NOT EXISTS "billedSeparately" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."backoffice_features"
SET "billedSeparately" = true
WHERE "parentId" IS NOT NULL
  AND "inheritParentSettings" = false;

-- 3. Backoffice adhesions: productId FK
ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "productId" UUID;

ALTER TABLE "public"."backoffice_adhesions" DROP CONSTRAINT IF EXISTS "backoffice_adhesions_productId_fkey";

ALTER TABLE "public"."backoffice_adhesions"
  ADD CONSTRAINT "backoffice_adhesions_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "public"."backoffice_products" ("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "backoffice_adhesions_product_id_idx"
  ON "public"."backoffice_adhesions" ("productId");

-- Backfill adhesion productId with default CRM product
UPDATE "public"."backoffice_adhesions" a
SET "productId" = p."id"
FROM "public"."backoffice_products" p
WHERE a."productId" IS NULL
  AND p."featureSlug" = 'crm'
  AND p."isDefault" = true;
