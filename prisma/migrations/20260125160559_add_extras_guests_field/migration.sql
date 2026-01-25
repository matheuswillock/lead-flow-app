-- AlterTable
ALTER TABLE "leads_schedule" ADD COLUMN     "extraGuests" TEXT[] DEFAULT ARRAY[]::TEXT[];
