-- Public forms: cover fields, calculation question type, rule elseAction
-- Idempotent where possible.

-- Enum value calculation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PublicFormQuestionType'
      AND e.enumlabel = 'calculation'
  ) THEN
    ALTER TYPE "public"."PublicFormQuestionType" ADD VALUE 'calculation';
  END IF;
END $$;

-- Cover badge + highlights
ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "coverBadge" text;

ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "coverHighlights" jsonb;

-- Senão branch on rules
ALTER TABLE "public"."corretor_studio_public_form_rules"
  ADD COLUMN IF NOT EXISTS "elseAction" public."PublicFormRuleAction";

UPDATE "public"."corretor_studio_public_form_rules"
SET "elseAction" = CASE
  WHEN "action" = 'show'::public."PublicFormRuleAction" THEN 'skip'::public."PublicFormRuleAction"
  ELSE 'show'::public."PublicFormRuleAction"
END
WHERE "elseAction" IS NULL;

ALTER TABLE "public"."corretor_studio_public_form_rules"
  ALTER COLUMN "elseAction" SET DEFAULT 'show'::public."PublicFormRuleAction";

ALTER TABLE "public"."corretor_studio_public_form_rules"
  ALTER COLUMN "elseAction" SET NOT NULL;
