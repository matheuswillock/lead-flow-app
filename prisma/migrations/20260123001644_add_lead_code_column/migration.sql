/*
  Warnings:

  - A unique constraint covering the columns `[leadCode]` on the table `leads` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "leadCode" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "meetingNotes" TEXT;

-- AlterTable
ALTER TABLE "leads_schedule" ADD COLUMN     "meetingLink" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadCode_key" ON "leads"("leadCode");
