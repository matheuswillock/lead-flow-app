-- Schema: associate sponsor link + proposal review + required documents
-- Idempotent where possible.

-- Profile.sponsorMasterId
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "sponsorMasterId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_profiles_sponsorMasterId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_profiles"
      ADD CONSTRAINT "corretor_studio_profiles_sponsorMasterId_fkey"
      FOREIGN KEY ("sponsorMasterId")
      REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_profiles_sponsorMasterId_idx"
  ON "public"."corretor_studio_profiles" ("sponsorMasterId");

-- Enums
DO $$ BEGIN
  CREATE TYPE "public"."LeadProposalReviewStatus" AS ENUM (
    'pending', 'submitted', 'criticized', 'approved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."LeadRequiredDocumentType" AS ENUM (
    'rg', 'address_proof', 'social_contract'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."LeadRequiredDocumentStatus" AS ENUM (
    'pending', 'uploaded', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LeadProposalReview
CREATE TABLE IF NOT EXISTS "public"."corretor_studio_lead_proposal_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "status" "public"."LeadProposalReviewStatus" NOT NULL DEFAULT 'pending',
  "criticizedTitle" TEXT,
  "criticizedMessage" TEXT,
  "criticizedAt" TIMESTAMPTZ(6),
  "reviewedByProfileId" UUID,
  "saleRegisteredAt" TIMESTAMPTZ(6),
  "salePayload" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_lead_proposal_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_lead_proposal_reviews_leadId_key"
  ON "public"."corretor_studio_lead_proposal_reviews" ("leadId");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_proposal_reviews_status_idx"
  ON "public"."corretor_studio_lead_proposal_reviews" ("status");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_proposal_reviews_reviewedByProfileId_idx"
  ON "public"."corretor_studio_lead_proposal_reviews" ("reviewedByProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_proposal_reviews_leadId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_proposal_reviews"
      ADD CONSTRAINT "corretor_studio_lead_proposal_reviews_leadId_fkey"
      FOREIGN KEY ("leadId")
      REFERENCES "public"."corretor_studio_leads"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_proposal_reviews_reviewedByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_proposal_reviews"
      ADD CONSTRAINT "corretor_studio_lead_proposal_reviews_reviewedByProfileId_fkey"
      FOREIGN KEY ("reviewedByProfileId")
      REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- LeadRequiredDocument
CREATE TABLE IF NOT EXISTS "public"."corretor_studio_lead_required_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "documentType" "public"."LeadRequiredDocumentType" NOT NULL,
  "status" "public"."LeadRequiredDocumentStatus" NOT NULL DEFAULT 'pending',
  "attachmentId" UUID,
  "reviewedByProfileId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_lead_required_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_lead_required_documents_leadId_documentType_key"
  ON "public"."corretor_studio_lead_required_documents" ("leadId", "documentType");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_required_documents_leadId_idx"
  ON "public"."corretor_studio_lead_required_documents" ("leadId");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_required_documents_status_idx"
  ON "public"."corretor_studio_lead_required_documents" ("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_required_documents_leadId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_required_documents"
      ADD CONSTRAINT "corretor_studio_lead_required_documents_leadId_fkey"
      FOREIGN KEY ("leadId")
      REFERENCES "public"."corretor_studio_leads"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_required_documents_attachmentId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_required_documents"
      ADD CONSTRAINT "corretor_studio_lead_required_documents_attachmentId_fkey"
      FOREIGN KEY ("attachmentId")
      REFERENCES "public"."corretor_studio_lead_attachments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_required_documents_reviewedByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_required_documents"
      ADD CONSTRAINT "corretor_studio_lead_required_documents_reviewedByProfileId_fkey"
      FOREIGN KEY ("reviewedByProfileId")
      REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS (scoped via lead team membership — service role bypasses; product uses API auth)
ALTER TABLE "public"."corretor_studio_lead_proposal_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_lead_required_documents" ENABLE ROW LEVEL SECURITY;
