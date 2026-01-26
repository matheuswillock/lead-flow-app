-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "closerId" UUID;

-- CreateIndex
CREATE INDEX "leads_closerId_idx" ON "leads"("closerId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
