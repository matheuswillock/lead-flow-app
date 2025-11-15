/*
  Warnings:

  - The `hasHealthPlan` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currentHealthPlan` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "HasHealthPlanStatus" AS ENUM ('Sim', 'Não');

-- CreateEnum
CREATE TYPE "HealthPlan" AS ENUM ('Nova Adesão', 'Amil', 'Bradesco', 'Hapvida', 'MedSênior', 'NotreDame Intermédica (GNDI)', 'Omint', 'Plena', 'Porto Seguro', 'Prevent Senior', 'SulAmérica', 'Unimed', 'Outros');

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "hasHealthPlan",
ADD COLUMN     "hasHealthPlan" "HasHealthPlanStatus",
DROP COLUMN "currentHealthPlan",
ADD COLUMN     "currentHealthPlan" "HealthPlan";
