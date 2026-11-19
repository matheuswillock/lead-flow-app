-- AlterTable
ALTER TABLE "backoffice_payments" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "corretor_studio_profile_subscriptions" ADD COLUMN IF NOT EXISTS "provider" TEXT;
