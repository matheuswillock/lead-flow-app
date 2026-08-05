-- Restrict Formulário básico (profession_health_plan) to Kathrein Antunes when that team exists.
-- Environments without the team keep teamId NULL (no FK violation); production has the team.

UPDATE public.corretor_studio_public_form_templates AS t
SET
  "teamId" = k.id,
  "updatedAt" = now()
FROM (
  SELECT id
  FROM public.corretor_studio_teams
  WHERE id = '28f7b9e8-9516-4a08-864c-9ff3e085ba87'::uuid
) AS k
WHERE t."slug" = 'profession_health_plan'
  AND (t."teamId" IS NULL OR t."teamId" IS DISTINCT FROM k.id);
