-- Add enum variant required by offer-submission closer gate seed (next migration).
-- NOTE: new enum values cannot be used in the same transaction as ALTER TYPE ADD VALUE.
ALTER TYPE "public"."BackofficeLeadTransitionGateType" ADD VALUE IF NOT EXISTS 'require_closer';
