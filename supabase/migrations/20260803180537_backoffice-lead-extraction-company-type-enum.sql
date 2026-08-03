-- Create enum for Brazilian company types
CREATE TYPE "public"."backoffice_company_type" AS ENUM (
  'MEI',
  'ME',
  'EPP',
  'EI',
  'EIRELI',
  'SLU',
  'LTDA',
  'SA',
  'SS',
  'OUTROS'
);

-- Migrate existing column from text to enum (safe: table was just created, no prod data yet)
ALTER TABLE "public"."backoffice_lead_extraction_results"
  ALTER COLUMN "type" TYPE "public"."backoffice_company_type"
  USING NULL;
