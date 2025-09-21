/*
  Warnings:

  - A unique constraint covering the columns `[confirmationToken]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "confirmationToken" TEXT,
ADD COLUMN     "confirmationTokenExp" TIMESTAMPTZ(6),
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_confirmationToken_key" ON "public"."profiles"("confirmationToken");
