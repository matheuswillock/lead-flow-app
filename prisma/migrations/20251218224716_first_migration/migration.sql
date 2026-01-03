-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('manager', 'operator');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new_opportunity', 'scheduled', 'no_show', 'pricingRequest', 'offerNegotiation', 'pending_documents', 'offerSubmission', 'dps_agreement', 'invoicePayment', 'disqualified', 'opportunityLost', 'operator_denied', 'contract_finalized');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('note', 'call', 'whatsapp', 'email', 'status_change');

-- CreateEnum
CREATE TYPE "HealthPlan" AS ENUM ('Nova Adesão', 'Amil', 'Bradesco', 'Hapvida', 'MedSênior', 'NotreDame Intermédica (GNDI)', 'Omint', 'Plena', 'Porto Seguro', 'Prevent Senior', 'SulAmérica', 'Unimed', 'Outros');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');

-- CreateEnum
CREATE TYPE "subscription_plan" AS ENUM ('free_trial', 'manager_base', 'with_operators');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "supabaseId" UUID,
    "fullName" TEXT,
    "phone" TEXT,
    "cpfCnpj" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "city" TEXT,
    "state" TEXT,
    "profileIconId" TEXT,
    "profileIconUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'manager',
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "hasPermanentSubscription" BOOLEAN NOT NULL DEFAULT false,
    "managerId" UUID,
    "asaasCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" "subscription_status",
    "subscriptionPlan" "subscription_plan",
    "operatorCount" INTEGER NOT NULL DEFAULT 0,
    "subscriptionStartDate" TIMESTAMPTZ(6),
    "subscriptionEndDate" TIMESTAMPTZ(6),
    "trialEndDate" TIMESTAMPTZ(6),
    "asaasSubscriptionId" TEXT,
    "subscriptionNextDueDate" TIMESTAMPTZ(6),
    "subscriptionCycle" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "assignedTo" UUID,
    "status" "LeadStatus" NOT NULL DEFAULT 'new_opportunity',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "cnpj" TEXT,
    "age" TEXT,
    "currentHealthPlan" "HealthPlan",
    "currentValue" DECIMAL(12,2),
    "referenceHospital" TEXT,
    "currentTreatment" TEXT,
    "meetingDate" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads_schedule" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_finalized" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "finalizedDateAt" TIMESTAMPTZ(6) NOT NULL,
    "startDateAt" TIMESTAMPTZ(6) NOT NULL,
    "duration" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_finalized_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_attachments" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_operators" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "paymentStatus" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "operatorCreated" BOOLEAN NOT NULL DEFAULT false,
    "operatorId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pending_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_id_key" ON "profiles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_supabaseId_key" ON "profiles"("supabaseId");

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "profiles_managerId_idx" ON "profiles"("managerId");

-- CreateIndex
CREATE INDEX "profiles_cpfCnpj_idx" ON "profiles"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "leads_id_key" ON "leads"("id");

-- CreateIndex
CREATE INDEX "leads_managerId_idx" ON "leads"("managerId");

-- CreateIndex
CREATE INDEX "leads_assignedTo_idx" ON "leads"("assignedTo");

-- CreateIndex
CREATE INDEX "leads_createdBy_idx" ON "leads"("createdBy");

-- CreateIndex
CREATE INDEX "leads_updatedBy_idx" ON "leads"("updatedBy");

-- CreateIndex
CREATE INDEX "leads_meetingDate_idx" ON "leads"("meetingDate");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_email_key" ON "leads"("managerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_phone_key" ON "leads"("managerId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_cnpj_key" ON "leads"("managerId", "cnpj");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_idx" ON "lead_activities"("leadId");

-- CreateIndex
CREATE INDEX "lead_activities_createdBy_idx" ON "lead_activities"("createdBy");

-- CreateIndex
CREATE INDEX "leads_schedule_leadId_idx" ON "leads_schedule"("leadId");

-- CreateIndex
CREATE INDEX "lead_finalized_leadId_idx" ON "lead_finalized"("leadId");

-- CreateIndex
CREATE INDEX "lead_attachments_leadId_idx" ON "lead_attachments"("leadId");

-- CreateIndex
CREATE INDEX "lead_attachments_uploadedBy_idx" ON "lead_attachments"("uploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "pending_operators_paymentId_key" ON "pending_operators"("paymentId");

-- CreateIndex
CREATE INDEX "pending_operators_managerId_idx" ON "pending_operators"("managerId");

-- CreateIndex
CREATE INDEX "pending_operators_subscriptionId_idx" ON "pending_operators"("subscriptionId");

-- CreateIndex
CREATE INDEX "pending_operators_email_idx" ON "pending_operators"("email");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads_schedule" ADD CONSTRAINT "leads_schedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_finalized" ADD CONSTRAINT "lead_finalized_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_attachments" ADD CONSTRAINT "lead_attachments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_attachments" ADD CONSTRAINT "lead_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_operators" ADD CONSTRAINT "pending_operators_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
