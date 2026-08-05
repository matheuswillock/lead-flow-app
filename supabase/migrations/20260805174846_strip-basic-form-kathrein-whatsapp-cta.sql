-- Remove Kathrein WhatsApp CTA from the global basic_form template draft.
-- profession_health_plan (Kathrein-scoped) keeps its WhatsApp actions unchanged.

UPDATE public.corretor_studio_public_form_templates
SET
  "draft" = jsonb_set(
    jsonb_set("draft", '{successActions}', '[]'::jsonb, true),
    '{thankYouPages}',
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN page ? 'actions' THEN jsonb_set(page, '{actions}', '[]'::jsonb, true)
            ELSE page
          END
        )
        FROM jsonb_array_elements(COALESCE("draft"->'thankYouPages', '[]'::jsonb)) AS page
      ),
      '[]'::jsonb
    ),
    true
  ),
  "updatedAt" = now()
WHERE "slug" = 'basic_form'
  AND (
    COALESCE("draft"->'successActions', '[]'::jsonb) <> '[]'::jsonb
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE("draft"->'thankYouPages', '[]'::jsonb)) AS page
      WHERE COALESCE(page->'actions', '[]'::jsonb) <> '[]'::jsonb
    )
  );
