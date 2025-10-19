-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');

-- CreateEnum
CREATE TYPE "subscription_plan" AS ENUM ('free_trial', 'manager_base', 'with_operators');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "operatorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionEndDate" TIMESTAMPTZ(6),
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "subscriptionPlan" "subscription_plan",
ADD COLUMN     "subscriptionStartDate" TIMESTAMPTZ(6),
ADD COLUMN     "subscriptionStatus" "subscription_status",
ADD COLUMN     "trialEndDate" TIMESTAMPTZ(6);
