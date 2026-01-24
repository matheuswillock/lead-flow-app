-- CreateEnum
CREATE TYPE "UserFunction" AS ENUM ('SDR', 'CLOSER');

-- CreateEnum
CREATE TYPE "MeetingHeald" AS ENUM ('yes', 'no');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "meetingHeald" "MeetingHeald";

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "functions" "UserFunction"[] DEFAULT ARRAY[]::"UserFunction"[];
