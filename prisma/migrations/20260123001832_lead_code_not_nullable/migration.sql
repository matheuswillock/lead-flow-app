/*
  Warnings:

  - Made the column `leadCode` on table `leads` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "leadCode" SET NOT NULL;
