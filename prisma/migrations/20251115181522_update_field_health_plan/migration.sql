/*
  Warnings:

  - You are about to drop the column `hasHealthPlan` on the `leads` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "leads" DROP COLUMN "hasHealthPlan";

-- DropEnum
DROP TYPE "public"."HasHealthPlanStatus";
