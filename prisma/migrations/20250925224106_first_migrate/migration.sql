-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('manager', 'operator');

-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('new_opportunity', 'scheduled', 'no_show', 'pricingRequest', 'offerNegotiation', 'pending_documents', 'offerSubmission', 'dps_agreement', 'invoicePayment', 'disqualified', 'opportunityLost', 'operator_denied', 'contract_finalized');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('note', 'call', 'whatsapp', 'email', 'status_change');

-- CreateEnum
CREATE TYPE "public"."AgeRange" AS ENUM ('0-18', '19-25', '26-35', '36-45', '46-60', '61+');

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "supabaseId" UUID,
    "fullName" TEXT,
    "phone" TEXT,
    "profileIconId" TEXT,
    "profileIconUrl" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'manager',
    "managerId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leads" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "assignedTo" UUID,
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'new_opportunity',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "cnpj" TEXT,
    "age" "public"."AgeRange"[],
    "hasHealthPlan" BOOLEAN DEFAULT false,
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
CREATE TABLE "public"."lead_activities" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_id_key" ON "public"."profiles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "public"."profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_supabaseId_key" ON "public"."profiles"("supabaseId");

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "public"."profiles"("role");

-- CreateIndex
CREATE INDEX "profiles_managerId_idx" ON "public"."profiles"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_id_key" ON "public"."leads"("id");

-- CreateIndex
CREATE INDEX "leads_managerId_idx" ON "public"."leads"("managerId");

-- CreateIndex
CREATE INDEX "leads_assignedTo_idx" ON "public"."leads"("assignedTo");

-- CreateIndex
CREATE INDEX "leads_createdBy_idx" ON "public"."leads"("createdBy");

-- CreateIndex
CREATE INDEX "leads_updatedBy_idx" ON "public"."leads"("updatedBy");

-- CreateIndex
CREATE INDEX "leads_meetingDate_idx" ON "public"."leads"("meetingDate");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_email_key" ON "public"."leads"("managerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_phone_key" ON "public"."leads"("managerId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_managerId_cnpj_key" ON "public"."leads"("managerId", "cnpj");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_idx" ON "public"."lead_activities"("leadId");

-- CreateIndex
CREATE INDEX "lead_activities_createdBy_idx" ON "public"."lead_activities"("createdBy");

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_activities" ADD CONSTRAINT "lead_activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
