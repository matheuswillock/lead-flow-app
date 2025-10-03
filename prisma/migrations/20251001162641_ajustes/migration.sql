/*
  Warnings:

  - You are about to drop the column `finalizedAt` on the `lead_finalized` table. All the data in the column will be lost.
  - Added the required column `duration` to the `lead_finalized` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalizedDateAt` to the `lead_finalized` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDateAt` to the `lead_finalized` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "lead_finalized" DROP COLUMN "finalizedAt",
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "finalizedDateAt" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "startDateAt" TIMESTAMPTZ(6) NOT NULL;
