/*
  Warnings:

  - A unique constraint covering the columns `[teamId,email]` on the table `leads` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamId,phone]` on the table `leads` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamId,cnpj]` on the table `leads` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "leads_managerId_cnpj_key";

-- DropIndex
DROP INDEX "leads_managerId_email_key";

-- DropIndex
DROP INDEX "leads_managerId_idx";

-- DropIndex
DROP INDEX "leads_managerId_phone_key";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "teamId" UUID;

-- AlterTable
ALTER TABLE "pending_operators" ADD COLUMN     "teamId" UUID;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "activeTeamId" UUID;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "masterId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "functions" "UserFunction"[] DEFAULT ARRAY[]::"UserFunction"[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_masterId_idx" ON "teams"("masterId");

-- CreateIndex
CREATE INDEX "team_members_profileId_idx" ON "team_members"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_profileId_key" ON "team_members"("teamId", "profileId");

-- CreateIndex
CREATE INDEX "leads_teamId_idx" ON "leads"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_teamId_email_key" ON "leads"("teamId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_teamId_phone_key" ON "leads"("teamId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_teamId_cnpj_key" ON "leads"("teamId", "cnpj");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_operators" ADD CONSTRAINT "pending_operators_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
