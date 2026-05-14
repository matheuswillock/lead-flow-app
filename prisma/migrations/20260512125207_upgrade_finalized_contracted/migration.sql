-- Migration generated from database diff to prisma/schema.prisma
-- NOTE: Columns closerId, leadBirthDate, operadora are added nullable first
-- for existing rows, then the NOT NULL constraint is applied via the application layer.
-- Existing lead_finalized rows pre-date this feature and won't have these values.

-- AlterTable: add new columns (closerId nullable FK, others with safe defaults)
ALTER TABLE "lead_finalized"
  ADD COLUMN IF NOT EXISTS "closerId" UUID,
  ADD COLUMN IF NOT EXISTS "contractFileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "contractStoragePath" TEXT,
  ADD COLUMN IF NOT EXISTS "leadBirthDate" DATE,
  ADD COLUMN IF NOT EXISTS "operadora" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "productName" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_finalized_dependents" (
    "id" UUID NOT NULL,
    "leadFinalizedId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "parentesco" TEXT NOT NULL,
    "document" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_finalized_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_finalized_dependents_leadFinalizedId_idx" ON "lead_finalized_dependents"("leadFinalizedId");

-- AddForeignKey (only if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_finalized_closerId_fkey'
  ) THEN
    ALTER TABLE "lead_finalized" ADD CONSTRAINT "lead_finalized_closerId_fkey"
      FOREIGN KEY ("closerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_finalized_dependents_leadFinalizedId_fkey'
  ) THEN
    ALTER TABLE "lead_finalized_dependents" ADD CONSTRAINT "lead_finalized_dependents_leadFinalizedId_fkey"
      FOREIGN KEY ("leadFinalizedId") REFERENCES "lead_finalized"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
