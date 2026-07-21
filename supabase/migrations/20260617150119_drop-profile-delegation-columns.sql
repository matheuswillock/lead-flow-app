ALTER TABLE "public"."corretor_studio_profiles"
  DROP COLUMN IF EXISTS "canCreateAccountUsers",
  DROP COLUMN IF EXISTS "canManageAccountTeams",
  DROP COLUMN IF EXISTS "canTransferAccountLeads";
