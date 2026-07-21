-- Add CRM funnel statuses and offer pre-contract fields.
-- Idempotent where possible. Intentionally scoped (no unrelated drift).

-- 1) Enum: new BackofficeLeadStatus values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'backoffice_lead_status' AND e.enumlabel = 'proposal'
  ) THEN
    ALTER TYPE "public"."backoffice_lead_status" ADD VALUE 'proposal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'backoffice_lead_status' AND e.enumlabel = 'future_contact'
  ) THEN
    ALTER TYPE "public"."backoffice_lead_status" ADD VALUE 'future_contact';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'backoffice_lead_status' AND e.enumlabel = 'deal_closed'
  ) THEN
    ALTER TYPE "public"."backoffice_lead_status" ADD VALUE 'deal_closed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'backoffice_lead_status' AND e.enumlabel = 'disqualified'
  ) THEN
    ALTER TYPE "public"."backoffice_lead_status" ADD VALUE 'disqualified';
  END IF;
END $$;

-- 2) Offer: pre-contract + tokenPlain for share URL rebuild
ALTER TABLE "public"."backoffice_lead_offers"
  ADD COLUMN IF NOT EXISTS "insuranceAmount" numeric(12, 2);

ALTER TABLE "public"."backoffice_lead_offers"
  ADD COLUMN IF NOT EXISTS "tokenPlain" text;

ALTER TABLE "public"."backoffice_lead_offers"
  ADD COLUMN IF NOT EXISTS "preContractExpiresAt" timestamp(6) with time zone;

-- Backfill existing rows before enforcing NOT NULL
UPDATE "public"."backoffice_lead_offers"
SET "preContractExpiresAt" = COALESCE("preContractExpiresAt", "shareExpiresAt", now() + interval '7 days')
WHERE "preContractExpiresAt" IS NULL;

ALTER TABLE "public"."backoffice_lead_offers"
  ALTER COLUMN "preContractExpiresAt" SET NOT NULL;
