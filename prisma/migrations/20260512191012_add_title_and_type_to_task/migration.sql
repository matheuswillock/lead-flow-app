-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('call', 'documentation', 'email', 'proposal', 'other');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "taskType" "task_type" NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;
