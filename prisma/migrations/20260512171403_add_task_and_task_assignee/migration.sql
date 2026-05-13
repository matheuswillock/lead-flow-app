-- Migration generated from database diff to prisma/schema.prisma

-- CreateEnum
CREATE TYPE "task_assignee_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELED', 'OVERDUE');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'task';

-- AlterTable
ALTER TABLE "lead_finalized" ALTER COLUMN "operadora" DROP NOT NULL,
ALTER COLUMN "operadora" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_finalized_dependents" ALTER COLUMN "document" DROP NOT NULL,
ALTER COLUMN "document" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "activityId" UUID,
    "body" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMPTZ(6),
    "endAt" TIMESTAMPTZ(6),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "status" "task_assignee_status" NOT NULL DEFAULT 'PENDING',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "googleSynced" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_activityId_key" ON "tasks"("activityId");

-- CreateIndex
CREATE INDEX "tasks_leadId_idx" ON "tasks"("leadId");

-- CreateIndex
CREATE INDEX "tasks_createdBy_idx" ON "tasks"("createdBy");

-- CreateIndex
CREATE INDEX "tasks_startAt_idx" ON "tasks"("startAt");

-- CreateIndex
CREATE INDEX "tasks_endAt_idx" ON "tasks"("endAt");

-- CreateIndex
CREATE INDEX "task_assignees_taskId_idx" ON "task_assignees"("taskId");

-- CreateIndex
CREATE INDEX "task_assignees_profileId_idx" ON "task_assignees"("profileId");

-- CreateIndex
CREATE INDEX "task_assignees_status_idx" ON "task_assignees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_profileId_key" ON "task_assignees"("taskId", "profileId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "lead_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
