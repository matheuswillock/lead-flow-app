-- CreateEnum
CREATE TYPE "notification_type" AS ENUM (
    'ACTIVITY_MENTION',
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_REMOVED',
    'LEAD_SCHEDULE_CREATED'
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipientProfileId" UUID NOT NULL,
    "actorProfileId" UUID,
    "teamId" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientProfileId_teamId_isRead_idx" ON "notifications"("recipientProfileId", "teamId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_recipientProfileId_createdAt_idx" ON "notifications"("recipientProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_teamId_createdAt_idx" ON "notifications"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientProfileId_fkey" FOREIGN KEY ("recipientProfileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
