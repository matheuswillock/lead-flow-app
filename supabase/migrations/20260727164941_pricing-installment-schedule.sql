-- Create installment_split_mode enum
DO $$ BEGIN
  CREATE TYPE "installment_split_mode" AS ENUM ('EQUAL', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add installmentSplitMode and installmentSchedule to backoffice_product_payment_rules
ALTER TABLE "public"."backoffice_product_payment_rules"
  ADD COLUMN IF NOT EXISTS "installmentSplitMode" "installment_split_mode" NOT NULL DEFAULT 'EQUAL',
  ADD COLUMN IF NOT EXISTS "installmentSchedule" JSONB NOT NULL DEFAULT '[]';
