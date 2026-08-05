-- Remove duplicate "Formulário básico" card: deactivate team-scoped profession_health_plan.
-- Active catalog templates must be global (teamId IS NULL).

UPDATE public.corretor_studio_public_form_templates
SET
  "isActive" = false,
  "updatedAt" = now()
WHERE "slug" = 'profession_health_plan'
  AND "isActive" = true;

UPDATE public.corretor_studio_public_form_templates
SET
  "teamId" = NULL,
  "updatedAt" = now()
WHERE "isActive" = true
  AND "teamId" IS NOT NULL;
