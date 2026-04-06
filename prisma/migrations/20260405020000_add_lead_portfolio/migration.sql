-- CreateEnum
CREATE TYPE "portfolio_status" AS ENUM ('active', 'pending', 'canceled');

-- CreateTable
CREATE TABLE "lead_portfolio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leadId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "portfolioStatus" "portfolio_status" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "lastContactAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_portfolio_leadId_key" ON "lead_portfolio"("leadId");

-- CreateIndex
CREATE INDEX "lead_portfolio_teamId_idx" ON "lead_portfolio"("teamId");

-- CreateIndex
CREATE INDEX "lead_portfolio_teamId_portfolioStatus_idx" ON "lead_portfolio"("teamId", "portfolioStatus");

-- AddForeignKey
ALTER TABLE "lead_portfolio" ADD CONSTRAINT "lead_portfolio_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_portfolio" ADD CONSTRAINT "lead_portfolio_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: criar LeadPortfolio para leads já finalizados
INSERT INTO "lead_portfolio" ("id", "leadId", "teamId", "portfolioStatus", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    l."id",
    l."teamId",
    'active'::"portfolio_status",
    NOW(),
    NOW()
FROM "leads" l
WHERE l."status" = 'contract_finalized'
  AND l."teamId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "lead_portfolio" lp WHERE lp."leadId" = l."id"
  );
