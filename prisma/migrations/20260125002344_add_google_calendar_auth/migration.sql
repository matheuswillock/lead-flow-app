-- AlterTable
ALTER TABLE "leads_schedule" ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiresAt" TIMESTAMPTZ(6);
