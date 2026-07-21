-- Backfill editorMode for pre-existing templates.
-- Templates that have HTML content but no blocks JSON (mailyJson is null or empty)
-- were authored in HTML mode, so mark them accordingly.
UPDATE "public"."corretor_studio_email_templates"
SET "editorMode" = 'html'
WHERE "html" IS NOT NULL
  AND btrim("html") <> ''
  AND ("mailyJson" IS NULL OR "mailyJson"::text IN ('null', '{}'));
