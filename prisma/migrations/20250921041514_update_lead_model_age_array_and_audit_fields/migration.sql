/*
  Warnings:

  - The `age` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."AgeRange" AS ENUM ('0-18', '19-25', '26-35', '36-45', '46-60', '61+');

-- AlterTable
ALTER TABLE "public"."leads" ADD COLUMN     "createdBy" UUID,
ADD COLUMN     "updatedBy" UUID,
DROP COLUMN "age",
ADD COLUMN     "age" "public"."AgeRange"[];

-- CreateIndex
CREATE INDEX "leads_createdBy_idx" ON "public"."leads"("createdBy");

-- CreateIndex
CREATE INDEX "leads_updatedBy_idx" ON "public"."leads"("updatedBy");

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
