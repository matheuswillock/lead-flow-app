-- Migration generated from database diff to prisma/schema.prisma

-- AlterTable
ALTER TABLE "backoffice_features" ADD COLUMN     "inheritParentSettings" BOOLEAN NOT NULL DEFAULT false;
