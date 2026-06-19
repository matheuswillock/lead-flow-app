ALTER TABLE "public"."corretor_studio_team_members"
  ADD COLUMN IF NOT EXISTS "canTransferAccountLeads" BOOLEAN NOT NULL DEFAULT false;
