-- CreateEnum
CREATE TYPE "pending_action_type" AS ENUM ('create_team', 'add_member', 'add_user', 'transfer_team');

-- CreateEnum
CREATE TYPE "pending_action_status" AS ENUM ('pending', 'applied', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "pending_actions" (
    "id" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "teamId" UUID,
    "actionType" "pending_action_type" NOT NULL,
    "status" "pending_action_status" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "checkoutId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_actions_masterId_idx" ON "pending_actions"("masterId");

-- CreateIndex
CREATE INDEX "pending_actions_checkoutId_idx" ON "pending_actions"("checkoutId");

-- CreateIndex
CREATE INDEX "pending_actions_paymentId_idx" ON "pending_actions"("paymentId");

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
