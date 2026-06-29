ALTER TABLE "public"."corretor_studio_team_members"
  ADD COLUMN IF NOT EXISTS "canViewAllTeams" boolean NOT NULL DEFAULT false;
