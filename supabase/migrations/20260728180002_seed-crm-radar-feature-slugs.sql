-- Estágio 4: CRM - Radar como bundle crm + radar
UPDATE "public"."backoffice_products"
SET "featureSlugs" = ARRAY['crm', 'radar']
WHERE name = 'CRM - Radar'
  AND NOT ('radar' = ANY("featureSlugs"));
