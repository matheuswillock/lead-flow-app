-- DropIndex
DROP INDEX "public"."pending_operators_paymentId_key";

-- AlterTable
ALTER TABLE "pending_operators" ADD COLUMN     "subscriptionId" TEXT,
ALTER COLUMN "paymentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "asaasSubscriptionId" TEXT,
ADD COLUMN     "subscriptionCycle" TEXT,
ADD COLUMN     "subscriptionNextDueDate" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "pending_operators_subscriptionId_idx" ON "pending_operators"("subscriptionId");
