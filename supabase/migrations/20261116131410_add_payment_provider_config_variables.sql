-- AlterTable
ALTER TABLE "payment_provider_configs" ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "payment_provider_configs" ALTER COLUMN "variables" SET DEFAULT '[]'::jsonb;

UPDATE public.payment_provider_configs
SET variables = '[]'::jsonb
WHERE variables = '{}'::jsonb;

UPDATE public.payment_provider_configs
SET variables = jsonb_build_array(jsonb_build_object(
  'name', CASE environment::text
    WHEN 'DEV' THEN 'ABACATE_PAY_DEV_PUBLIC_KEY'
    ELSE 'ABACATE_PAY_PRODUCTION_PUBLIC_KEY'
  END,
  'visibility', 'PUBLIC',
  'value', btrim(public_key)
))
WHERE provider_key::text = 'ABACATE_PAY'
  AND public_key IS NOT NULL
  AND btrim(public_key) <> ''
  AND variables = '[]'::jsonb;
