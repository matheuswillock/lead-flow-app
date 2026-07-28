-- Public forms builder enhancements: theme tokens, success CTAs, scoring budget, option polarity, nullable rule target (thank-you).

ALTER TABLE "public"."corretor_studio_public_form_settings"
  ADD COLUMN IF NOT EXISTS "defaultAccentColor" VARCHAR(7) NOT NULL DEFAULT '#FF6900',
  ADD COLUMN IF NOT EXISTS "defaultButtonTextColor" VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS "defaultInputBackgroundColor" VARCHAR(7) NOT NULL DEFAULT '#FFFFFF';

ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "successActions" JSONB,
  ADD COLUMN IF NOT EXISTS "accentColor" VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "buttonTextColor" VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "inputBackgroundColor" VARCHAR(7);

ALTER TABLE "public"."corretor_studio_public_form_questions"
  ADD COLUMN IF NOT EXISTS "scoreWeight" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."corretor_studio_public_form_options"
  ADD COLUMN IF NOT EXISTS "scorePolarity" VARCHAR(16) NOT NULL DEFAULT 'positive';

ALTER TABLE "public"."corretor_studio_public_form_rules"
  ALTER COLUMN "targetQuestionId" DROP NOT NULL;

-- Backfill equal scoreWeight per form when all weights are still 0.
DO $$
DECLARE
  form_rec RECORD;
  q_count INTEGER;
  base_weight INTEGER;
  remainder INTEGER;
  q_rec RECORD;
  idx INTEGER;
BEGIN
  FOR form_rec IN
    SELECT f.id
    FROM "public"."corretor_studio_public_forms" f
    WHERE EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_public_form_questions" q
      WHERE q."formId" = f.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_public_form_questions" q
      WHERE q."formId" = f.id AND q."scoreWeight" <> 0
    )
  LOOP
    SELECT COUNT(*) INTO q_count
    FROM "public"."corretor_studio_public_form_questions"
    WHERE "formId" = form_rec.id;

    IF q_count <= 0 THEN
      CONTINUE;
    END IF;

    base_weight := FLOOR(100 / q_count);
    remainder := 100 - (base_weight * q_count);
    idx := 0;

    FOR q_rec IN
      SELECT id
      FROM "public"."corretor_studio_public_form_questions"
      WHERE "formId" = form_rec.id
      ORDER BY "position" ASC
    LOOP
      UPDATE "public"."corretor_studio_public_form_questions"
      SET "scoreWeight" = base_weight + CASE WHEN idx < remainder THEN 1 ELSE 0 END
      WHERE id = q_rec.id;
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;
