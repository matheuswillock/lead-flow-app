-- CreateEnum
CREATE TYPE "email_credit_plan" AS ENUM ('starter', 'plus', 'pro', 'business');

-- CreateEnum
CREATE TYPE "email_credit_subscription_status" AS ENUM ('active', 'suspended', 'canceled');

-- CreateEnum
CREATE TYPE "email_campaign_status" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "email_log_status" AS ENUM ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed');

-- CreateEnum
CREATE TYPE "email_event_type" AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delivery_delayed', 'unsubscribed');

-- CreateTable
CREATE TABLE "email_credit_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "plan" "email_credit_plan" NOT NULL,
    "monthlyCredits" INTEGER NOT NULL,
    "status" "email_credit_subscription_status" NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMPTZ(6) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(6) NOT NULL,
    "canceledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_credit_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_credit_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscriptionId" UUID NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "overageCount" INTEGER NOT NULL DEFAULT 0,
    "overageCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_credit_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "mailyJson" JSONB,
    "html" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_contact_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "csvStoragePath" TEXT,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_contact_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "customFields" JSONB,
    "isUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "isBounced" BOOLEAN NOT NULL DEFAULT false,
    "isComplained" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" UUID NOT NULL,
    "contactListId" UUID NOT NULL,
    "status" "email_campaign_status" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "campaignId" UUID,
    "resendEmailId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "email_log_status" NOT NULL DEFAULT 'queued',
    "sentAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "openedAt" TIMESTAMPTZ(6),
    "clickedAt" TIMESTAMPTZ(6),
    "bouncedAt" TIMESTAMPTZ(6),
    "complainedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "logId" UUID NOT NULL,
    "type" "email_event_type" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_credit_subscriptions_profileId_key" ON "email_credit_subscriptions"("profileId");
CREATE INDEX "email_credit_subscriptions_currentPeriodEnd_idx" ON "email_credit_subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "email_credit_usages_subscriptionId_periodStart_key" ON "email_credit_usages"("subscriptionId", "periodStart");

-- CreateIndex
CREATE INDEX "email_templates_teamId_isArchived_idx" ON "email_templates"("teamId", "isArchived");
CREATE INDEX "email_templates_createdBy_idx" ON "email_templates"("createdBy");

-- CreateIndex
CREATE INDEX "email_contact_lists_teamId_isArchived_idx" ON "email_contact_lists"("teamId", "isArchived");
CREATE INDEX "email_contact_lists_createdBy_idx" ON "email_contact_lists"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "email_contacts_listId_email_key" ON "email_contacts"("listId", "email");
CREATE INDEX "email_contacts_listId_isUnsubscribed_idx" ON "email_contacts"("listId", "isUnsubscribed");
CREATE INDEX "email_contacts_listId_isBounced_idx" ON "email_contacts"("listId", "isBounced");

-- CreateIndex
CREATE INDEX "email_campaigns_teamId_status_idx" ON "email_campaigns"("teamId", "status");
CREATE INDEX "email_campaigns_teamId_scheduledAt_idx" ON "email_campaigns"("teamId", "scheduledAt");
CREATE INDEX "email_campaigns_createdBy_idx" ON "email_campaigns"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_resendEmailId_key" ON "email_logs"("resendEmailId");
CREATE INDEX "email_logs_teamId_status_idx" ON "email_logs"("teamId", "status");
CREATE INDEX "email_logs_teamId_campaignId_idx" ON "email_logs"("teamId", "campaignId");
CREATE INDEX "email_logs_recipientEmail_idx" ON "email_logs"("recipientEmail");
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt" DESC);

-- CreateIndex
CREATE INDEX "email_events_logId_occurredAt_idx" ON "email_events"("logId", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "email_credit_subscriptions" ADD CONSTRAINT "email_credit_subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_credit_usages" ADD CONSTRAINT "email_credit_usages_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "email_credit_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_contact_lists" ADD CONSTRAINT "email_contact_lists_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_contact_lists" ADD CONSTRAINT "email_contact_lists_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_contacts" ADD CONSTRAINT "email_contacts_listId_fkey" FOREIGN KEY ("listId") REFERENCES "email_contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "email_contact_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_logId_fkey" FOREIGN KEY ("logId") REFERENCES "email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
