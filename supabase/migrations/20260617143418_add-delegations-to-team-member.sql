ALTER TABLE "public"."corretor_studio_team_members"
  ADD COLUMN IF NOT EXISTS "canCreateAccountUsers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageAccountTeams" BOOLEAN NOT NULL DEFAULT false;
