-- Migration generated from database diff to prisma/schema.prisma

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "task_type" ADD VALUE 'whatsapp';
ALTER TYPE "task_type" ADD VALUE 'meeting';
