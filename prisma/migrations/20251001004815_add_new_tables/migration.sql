-- CreateTable
CREATE TABLE "public"."leads_schedule" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_finalized" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "finalizedAt" TIMESTAMPTZ(6) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_finalized_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_schedule_leadId_idx" ON "public"."leads_schedule"("leadId");

-- CreateIndex
CREATE INDEX "lead_finalized_leadId_idx" ON "public"."lead_finalized"("leadId");

-- AddForeignKey
ALTER TABLE "public"."leads_schedule" ADD CONSTRAINT "leads_schedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_finalized" ADD CONSTRAINT "lead_finalized_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
