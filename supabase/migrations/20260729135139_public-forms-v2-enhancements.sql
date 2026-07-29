-- Public forms v2: multiple thank-you pages, completion status, rule targets

DO $$ BEGIN
  CREATE TYPE "public"."PublicFormCompletionStatus" AS ENUM ('initial', 'partial', 'complete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "thankYouPages" JSONB,
  ADD COLUMN IF NOT EXISTS "defaultThankYouPageId" UUID;

ALTER TABLE "public"."corretor_studio_public_form_rules"
  ADD COLUMN IF NOT EXISTS "targetThankYouPageId" UUID;

ALTER TABLE "public"."corretor_studio_public_form_submissions"
  ADD COLUMN IF NOT EXISTS "visitorSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "completionStatus" "public"."PublicFormCompletionStatus" NOT NULL DEFAULT 'initial';

CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_submissions_publicationId_visitorSess_idx"
  ON "public"."corretor_studio_public_form_submissions" ("publicationId", "visitorSessionId");

-- Backfill thank-you pages from legacy flat fields
UPDATE "public"."corretor_studio_public_forms"
SET
  "thankYouPages" = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Página padrão',
      'title', COALESCE("successTitle", 'Respostas enviadas'),
      'description', "successDescription",
      'actions', COALESCE("successActions", '[]'::jsonb),
      'kind', CASE WHEN "formKind" = 'health_plan_simulator' THEN 'simulation' ELSE 'standard' END,
      'isDefault', true
    )
  ),
  "defaultThankYouPageId" = gen_random_uuid()
WHERE "thankYouPages" IS NULL;

-- Align defaultThankYouPageId with first page id in JSON (second pass for consistency)
UPDATE "public"."corretor_studio_public_forms"
SET "defaultThankYouPageId" = (("thankYouPages"->0->>'id')::uuid)
WHERE "thankYouPages" IS NOT NULL
  AND jsonb_array_length("thankYouPages") > 0
  AND ("defaultThankYouPageId" IS NULL OR "defaultThankYouPageId"::text <> ("thankYouPages"->0->>'id'));

-- Mark existing completed submissions
UPDATE "public"."corretor_studio_public_form_submissions"
SET "completionStatus" = 'complete'
WHERE "status" = 'completed';
