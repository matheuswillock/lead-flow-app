-- CreateEnum
CREATE TYPE "TeamStatusRuleType" AS ENUM ('disabled_status', 'lead_time', 'combined_transition');

-- CreateEnum
CREATE TYPE "TeamLeadTimeUnit" AS ENUM ('hours', 'days');

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'future_sale';

-- AlterTable
ALTER TABLE "leads"
ADD COLUMN "followUpAt" TIMESTAMPTZ(6),
ADD COLUMN "followUpNotes" TEXT,
ADD COLUMN "followUpSourceStatus" "LeadStatus",
ADD COLUMN "lossReason" TEXT,
ADD COLUMN "lossReasonDetails" TEXT,
ADD COLUMN "statusEnteredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "team_filter_presets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "queryJson" JSONB NOT NULL,
  "lastUsedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "team_filter_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_status_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "type" "TeamStatusRuleType" NOT NULL,
  "targetStatus" "LeadStatus" NOT NULL,
  "requiredStatus" "LeadStatus",
  "leadTimeValue" INTEGER,
  "leadTimeUnit" "TeamLeadTimeUnit",
  "requireConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "confirmationMessage" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "team_status_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_followUpAt_idx" ON "leads"("followUpAt");

-- CreateIndex
CREATE INDEX "leads_statusEnteredAt_idx" ON "leads"("statusEnteredAt");

-- CreateIndex
CREATE INDEX "team_filter_presets_teamId_createdBy_idx" ON "team_filter_presets"("teamId", "createdBy");

-- CreateIndex
CREATE INDEX "team_filter_presets_teamId_lastUsedAt_idx" ON "team_filter_presets"("teamId", "lastUsedAt" DESC);

-- CreateIndex
CREATE INDEX "team_status_rules_teamId_isEnabled_idx" ON "team_status_rules"("teamId", "isEnabled");

-- CreateIndex
CREATE INDEX "team_status_rules_teamId_type_targetStatus_isEnabled_idx" ON "team_status_rules"("teamId", "type", "targetStatus", "isEnabled");

-- AddForeignKey
ALTER TABLE "team_filter_presets" ADD CONSTRAINT "team_filter_presets_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_filter_presets" ADD CONSTRAINT "team_filter_presets_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_status_rules" ADD CONSTRAINT "team_status_rules_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_status_rules" ADD CONSTRAINT "team_status_rules_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
