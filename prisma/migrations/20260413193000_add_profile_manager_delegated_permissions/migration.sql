ALTER TABLE "profiles"
ADD COLUMN "canCreateAccountUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canManageAccountTeams" BOOLEAN NOT NULL DEFAULT false;
