-- O baseline criou backoffice_products_slug_key como CREATE UNIQUE INDEX (não uma constraint).
-- A migration 20260630191139_pricing-multi-slug-schema usou DROP CONSTRAINT IF EXISTS, que não
-- remove um índice standalone, então o índice único permaneceu ativo sobre a coluna renomeada
-- featureSlug e continua bloqueando múltiplos produtos com o mesmo slug.
DROP INDEX IF EXISTS "public"."backoffice_products_slug_key";
