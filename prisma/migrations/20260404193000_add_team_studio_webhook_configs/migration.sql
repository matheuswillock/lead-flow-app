-- CreateEnum
CREATE TYPE "studio_webhook_token_expiry_mode" AS ENUM ('hours_24', 'months_6', 'indeterminate');

-- CreateTable
CREATE TABLE "team_studio_webhook_configs" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "expiryMode" "studio_webhook_token_expiry_mode" NOT NULL DEFAULT 'indeterminate',
    "expiresAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "updatedByProfileId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_studio_webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_studio_webhook_configs_teamId_key" ON "team_studio_webhook_configs"("teamId");

-- CreateIndex
CREATE INDEX "team_studio_webhook_configs_updatedByProfileId_idx" ON "team_studio_webhook_configs"("updatedByProfileId");

-- CreateIndex
CREATE INDEX "team_studio_webhook_configs_expiresAt_idx" ON "team_studio_webhook_configs"("expiresAt");

-- AddForeignKey
ALTER TABLE "team_studio_webhook_configs"
ADD CONSTRAINT "team_studio_webhook_configs_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_studio_webhook_configs"
ADD CONSTRAINT "team_studio_webhook_configs_updatedByProfileId_fkey"
FOREIGN KEY ("updatedByProfileId") REFERENCES "profiles"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
