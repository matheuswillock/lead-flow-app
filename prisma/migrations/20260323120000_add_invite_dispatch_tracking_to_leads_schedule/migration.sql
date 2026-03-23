-- CreateEnum
CREATE TYPE "InviteDispatchStatus" AS ENUM ('sent_google', 'sent_resend', 'failed');

-- AlterTable
ALTER TABLE "leads_schedule"
ADD COLUMN "inviteDispatchStatus" "InviteDispatchStatus",
ADD COLUMN "inviteDispatchFallbackUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inviteDispatchLastAttemptAt" TIMESTAMPTZ(6),
ADD COLUMN "inviteDispatchLastError" TEXT,
ADD COLUMN "inviteDispatchLastPayload" JSONB;
