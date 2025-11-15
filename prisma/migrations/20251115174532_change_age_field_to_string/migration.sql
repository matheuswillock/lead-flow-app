/*
  Warnings:

  - The `age` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "leads" DROP COLUMN "age",
ADD COLUMN     "age" TEXT;

-- DropEnum
DROP TYPE "public"."AgeRange";
