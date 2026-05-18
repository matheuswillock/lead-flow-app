-- Migration generated from database diff to prisma/schema.prisma

-- CreateEnum
CREATE TYPE "portfolio_source" AS ENUM ('crm', 'manual', 'brokerage_transfer');

-- AlterTable
ALTER TABLE "lead_portfolio" ADD COLUMN     "source" "portfolio_source" NOT NULL DEFAULT 'crm';
