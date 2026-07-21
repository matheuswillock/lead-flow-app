-- R4: Rename feature slug 'cdp' → 'radar' in backoffice_features and backoffice_products.
-- FK references use UUIDs (id), so renaming the slug/featureSlug is safe;
-- backoffice_feature_access_rules and backoffice_product_payment_rules are unaffected.
UPDATE "public"."backoffice_features"
SET
  slug        = 'radar',
  name        = 'Radar',
  description = 'Radar — perfis unificados, segmentos e timeline para campanhas de e-mail.',
  "updatedAt" = now()
WHERE slug = 'cdp';

UPDATE "public"."backoffice_products"
SET
  "featureSlug" = 'radar',
  "updatedAt"   = now()
WHERE "featureSlug" = 'cdp';
