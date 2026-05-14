-- Migration generated from database diff to prisma/schema.prisma

-- AlterTable
ALTER TABLE "lead_finalized" DROP COLUMN "leadBirthDate";

-- CreateTable
CREATE TABLE "lead_finalized_holders" (
    "id" UUID NOT NULL,
    "leadFinalizedId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "document" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_finalized_holders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_finalized_holders_leadFinalizedId_key" ON "lead_finalized_holders"("leadFinalizedId");

-- AddForeignKey
ALTER TABLE "lead_finalized_holders" ADD CONSTRAINT "lead_finalized_holders_leadFinalizedId_fkey" FOREIGN KEY ("leadFinalizedId") REFERENCES "lead_finalized"("id") ON DELETE CASCADE ON UPDATE CASCADE;
