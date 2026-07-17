-- CreateEnum
CREATE TYPE "backoffice_email_campaign_status" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "backoffice_email_campaign_type" AS ENUM ('live_weekly');

-- CreateEnum
CREATE TYPE "backoffice_email_campaign_dispatch_status" AS ENUM ('sending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "backoffice_email_log_status" AS ENUM ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed');

-- CreateEnum
CREATE TYPE "backoffice_email_event_type" AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delivery_delayed', 'unsubscribed', 'failed');

-- CreateEnum
CREATE TYPE "backoffice_email_orphan_event_status" AS ENUM ('pending', 'processed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "backoffice_email_import_job_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "backoffice_email_import_source_format" AS ENUM ('csv', 'json');

-- CreateTable
CREATE TABLE "backoffice_email_contact_lists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "createdByBackofficeUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_contact_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_contacts" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "customFields" JSONB,
    "isUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "isBounced" BOOLEAN NOT NULL DEFAULT false,
    "isComplained" BOOLEAN NOT NULL DEFAULT false,
    "backofficeLeadId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_import_jobs" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "sourceFormat" "backoffice_email_import_source_format" NOT NULL,
    "rawContent" TEXT NOT NULL,
    "status" "backoffice_email_import_job_status" NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdByBackofficeUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "backoffice_email_campaign_type" NOT NULL DEFAULT 'live_weekly',
    "status" "backoffice_email_campaign_status" NOT NULL DEFAULT 'draft',
    "resendTemplateId" TEXT,
    "resendTemplateName" TEXT,
    "contactListId" UUID NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
    "sentAt" TIMESTAMPTZ(6),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "dispatchCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdByBackofficeUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_campaign_dispatches" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "dispatchNumber" INTEGER NOT NULL,
    "templateSubjectSnapshot" TEXT NOT NULL,
    "templateHtmlSnapshot" TEXT NOT NULL,
    "resendTemplateIdSnapshot" TEXT,
    "status" "backoffice_email_campaign_dispatch_status" NOT NULL DEFAULT 'sending',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "triggeredByBackofficeUserId" UUID,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_campaign_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_logs" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "status" "backoffice_email_log_status" NOT NULL DEFAULT 'queued',
    "sentAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "openedAt" TIMESTAMPTZ(6),
    "clickedAt" TIMESTAMPTZ(6),
    "bouncedAt" TIMESTAMPTZ(6),
    "complainedAt" TIMESTAMPTZ(6),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_events" (
    "id" UUID NOT NULL,
    "logId" UUID NOT NULL,
    "type" "backoffice_email_event_type" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backoffice_email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_email_orphan_events" (
    "id" UUID NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "resendEventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "tagsHint" JSONB,
    "status" "backoffice_email_orphan_event_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_email_orphan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backoffice_email_contact_lists_is_system_default_idx" ON "backoffice_email_contact_lists"("isSystemDefault");

-- CreateIndex
CREATE INDEX "backoffice_email_contact_lists_is_archived_idx" ON "backoffice_email_contact_lists"("isArchived");

-- CreateIndex
CREATE INDEX "backoffice_email_contacts_list_unsubscribed_idx" ON "backoffice_email_contacts"("listId", "isUnsubscribed");

-- CreateIndex
CREATE INDEX "backoffice_email_contacts_backoffice_lead_id_idx" ON "backoffice_email_contacts"("backofficeLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_contacts_list_email_key" ON "backoffice_email_contacts"("listId", "email");

-- CreateIndex
CREATE INDEX "backoffice_email_import_jobs_list_status_idx" ON "backoffice_email_import_jobs"("listId", "status");

-- CreateIndex
CREATE INDEX "backoffice_email_campaigns_status_idx" ON "backoffice_email_campaigns"("status");

-- CreateIndex
CREATE INDEX "backoffice_email_campaigns_type_status_idx" ON "backoffice_email_campaigns"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_campaigns_type_scheduled_at_key" ON "backoffice_email_campaigns"("type", "scheduledAt");

-- CreateIndex
CREATE INDEX "backoffice_email_campaign_dispatches_campaign_created_idx" ON "backoffice_email_campaign_dispatches"("campaignId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_campaign_dispatches_campaign_dispatch_key" ON "backoffice_email_campaign_dispatches"("campaignId", "dispatchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_logs_resendEmailId_key" ON "backoffice_email_logs"("resendEmailId");

-- CreateIndex
CREATE INDEX "backoffice_email_logs_campaign_dispatch_idx" ON "backoffice_email_logs"("campaignId", "dispatchId");

-- CreateIndex
CREATE INDEX "backoffice_email_logs_contact_id_idx" ON "backoffice_email_logs"("contactId");

-- CreateIndex
CREATE INDEX "backoffice_email_events_log_occurred_idx" ON "backoffice_email_events"("logId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_events_log_type_occurred_key" ON "backoffice_email_events"("logId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_email_orphan_events_resendEmailId_key" ON "backoffice_email_orphan_events"("resendEmailId");

-- CreateIndex
CREATE INDEX "backoffice_email_orphan_events_status_idx" ON "backoffice_email_orphan_events"("status");

-- AddForeignKey
ALTER TABLE "backoffice_email_contact_lists" ADD CONSTRAINT "backoffice_email_contact_lists_createdByBackofficeUserId_fkey" FOREIGN KEY ("createdByBackofficeUserId") REFERENCES "backoffice_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_contacts" ADD CONSTRAINT "backoffice_email_contacts_listId_fkey" FOREIGN KEY ("listId") REFERENCES "backoffice_email_contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_contacts" ADD CONSTRAINT "backoffice_email_contacts_backofficeLeadId_fkey" FOREIGN KEY ("backofficeLeadId") REFERENCES "backoffice_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_import_jobs" ADD CONSTRAINT "backoffice_email_import_jobs_listId_fkey" FOREIGN KEY ("listId") REFERENCES "backoffice_email_contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_import_jobs" ADD CONSTRAINT "backoffice_email_import_jobs_createdByBackofficeUserId_fkey" FOREIGN KEY ("createdByBackofficeUserId") REFERENCES "backoffice_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_campaigns" ADD CONSTRAINT "backoffice_email_campaigns_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "backoffice_email_contact_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_campaigns" ADD CONSTRAINT "backoffice_email_campaigns_createdByBackofficeUserId_fkey" FOREIGN KEY ("createdByBackofficeUserId") REFERENCES "backoffice_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_campaign_dispatches" ADD CONSTRAINT "backoffice_email_campaign_dispatches_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "backoffice_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_logs" ADD CONSTRAINT "backoffice_email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "backoffice_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_logs" ADD CONSTRAINT "backoffice_email_logs_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "backoffice_email_campaign_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_logs" ADD CONSTRAINT "backoffice_email_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "backoffice_email_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_email_events" ADD CONSTRAINT "backoffice_email_events_logId_fkey" FOREIGN KEY ("logId") REFERENCES "backoffice_email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
