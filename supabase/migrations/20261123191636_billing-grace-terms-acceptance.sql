-- AlterTable
ALTER TABLE "billing_grace_payments" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(6) WITH TIME ZONE;
ALTER TABLE "billing_grace_payments" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;
