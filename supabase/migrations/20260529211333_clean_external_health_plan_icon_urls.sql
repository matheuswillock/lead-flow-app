-- Limpa URLs legadas de ícone que não foram enviadas pelo upload do sistema (Supabase Storage).
-- Mantém apenas URLs públicas do bucket profile-icons.

UPDATE "corretor_studio_health_plan_options"
SET "iconUrl" = NULL
WHERE "iconUrl" IS NOT NULL
  AND "iconUrl" NOT LIKE '%/storage/v1/object/public/profile-icons/%';
