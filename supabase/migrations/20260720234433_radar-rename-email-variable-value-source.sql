-- R3: Rename EmailVariableValueSource enum value 'CDP' → 'RADAR'
-- Existing rows are updated automatically by Postgres when the enum value is renamed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.email_variable_value_source'::regtype
      AND enumlabel = 'CDP'
  ) THEN
    ALTER TYPE "public"."email_variable_value_source" RENAME VALUE 'CDP' TO 'RADAR';
  END IF;
END $$;
