-- CreateTable
CREATE TABLE "lead_activity_reactions" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "emojiUnified" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_activity_reactions_activityId_profileId_emojiUnified_key" ON "lead_activity_reactions"("activityId", "profileId", "emojiUnified");

-- CreateIndex
CREATE INDEX "lead_activity_reactions_activityId_idx" ON "lead_activity_reactions"("activityId");

-- CreateIndex
CREATE INDEX "lead_activity_reactions_profileId_idx" ON "lead_activity_reactions"("profileId");

-- AddForeignKey
ALTER TABLE "lead_activity_reactions" ADD CONSTRAINT "lead_activity_reactions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "lead_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity_reactions" ADD CONSTRAINT "lead_activity_reactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
