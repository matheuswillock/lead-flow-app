-- Reconcile EmailVariableValueSource (PascalCase) → email_variable_value_source (Prisma @@map).
-- Idempotent: safe on local resets and remote replay.

DO $$ BEGIN
  CREATE TYPE public.email_variable_value_source AS ENUM ('STATIC', 'CDP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'EmailVariableValueSource'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'email_team_variables'
      AND c.column_name = 'valueSource'
      AND c.udt_name = 'EmailVariableValueSource'
  ) THEN
    ALTER TABLE public.email_team_variables
      ALTER COLUMN "valueSource" DROP DEFAULT;

    ALTER TABLE public.email_team_variables
      ALTER COLUMN "valueSource" TYPE public.email_variable_value_source
      USING "valueSource"::text::public.email_variable_value_source;

    ALTER TABLE public.email_team_variables
      ALTER COLUMN "valueSource" SET DEFAULT 'STATIC'::public.email_variable_value_source;
  END IF;
END $$;

DROP TYPE IF EXISTS public."EmailVariableValueSource";
