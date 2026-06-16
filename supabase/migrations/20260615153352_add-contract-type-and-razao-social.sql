-- Create contract_type enum
CREATE TYPE "contract_type" AS ENUM ('individual', 'corporate', 'adhesion');

-- Add contractType to corretor_studio_lead_finalized
ALTER TABLE "corretor_studio_lead_finalized"
  ADD COLUMN IF NOT EXISTS "contractType" "contract_type" NOT NULL DEFAULT 'individual';

-- Add razaoSocial to corretor_studio_lead_finalized_holders
ALTER TABLE "corretor_studio_lead_finalized_holders"
  ADD COLUMN IF NOT EXISTS "razaoSocial" TEXT;
