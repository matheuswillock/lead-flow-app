-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('manual', 'meta_lead_ads', 'whatsapp', 'import', 'api');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'manual';
ALTER TABLE "leads" ADD COLUMN     "metaLeadgenId" TEXT;
ALTER TABLE "leads" ADD COLUMN     "metaFormId" TEXT;
ALTER TABLE "leads" ADD COLUMN     "metaAdId" TEXT;
ALTER TABLE "leads" ADD COLUMN     "metaPageId" TEXT;
ALTER TABLE "leads" ADD COLUMN     "whatsappFrom" TEXT;
ALTER TABLE "leads" ADD COLUMN     "whatsappMessageId" TEXT;
ALTER TABLE "leads" ADD COLUMN     "phoneNormalized" TEXT;

-- CreateTable
CREATE TABLE "meta_lead_integrations" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "teamId" UUID,
    "pageId" TEXT NOT NULL,
    "pageAccessTokenEnc" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "defaultAssigneeId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meta_lead_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_integrations" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "teamId" UUID,
    "businessAccountId" TEXT,
    "phoneNumberId" TEXT NOT NULL,
    "businessPhoneNumber" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_metaLeadgenId_key" ON "leads"("managerId", "metaLeadgenId");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_metaPageId_idx" ON "leads"("metaPageId");

-- CreateIndex
CREATE INDEX "leads_phoneNormalized_idx" ON "leads"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "meta_lead_integrations_managerId_pageId_key" ON "meta_lead_integrations"("managerId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_lead_integrations_verifyToken_key" ON "meta_lead_integrations"("verifyToken");

-- CreateIndex
CREATE INDEX "meta_lead_integrations_pageId_idx" ON "meta_lead_integrations"("pageId");

-- CreateIndex
CREATE INDEX "meta_lead_integrations_managerId_idx" ON "meta_lead_integrations"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_integrations_managerId_phoneNumberId_key" ON "whatsapp_integrations"("managerId", "phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_integrations_verifyToken_key" ON "whatsapp_integrations"("verifyToken");

-- CreateIndex
CREATE INDEX "whatsapp_integrations_phoneNumberId_idx" ON "whatsapp_integrations"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_integrations_managerId_idx" ON "whatsapp_integrations"("managerId");

-- AddForeignKey
ALTER TABLE "meta_lead_integrations" ADD CONSTRAINT "meta_lead_integrations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_lead_integrations" ADD CONSTRAINT "meta_lead_integrations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_lead_integrations" ADD CONSTRAINT "meta_lead_integrations_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_integrations" ADD CONSTRAINT "whatsapp_integrations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_integrations" ADD CONSTRAINT "whatsapp_integrations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
