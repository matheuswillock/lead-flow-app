CREATE TYPE "public"."BackofficeLegalDocumentType" AS ENUM ('terms', 'privacy', 'contract');
CREATE TYPE "public"."BackofficeTermsAcceptanceOutboxType" AS ENUM ('generate_evidence', 'send_confirmation_email', 'send_password_recovery');
CREATE TYPE "public"."BackofficeTermsAcceptanceOutboxStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN "termsAcceptanceRequired" boolean NOT NULL DEFAULT false,
  ADD COLUMN "acceptanceTokenHash" text,
  ADD COLUMN "acceptanceTokenPreview" text,
  ADD COLUMN "acceptanceTokenIssuedAt" timestamptz(6),
  ADD COLUMN "acceptanceTokenExpiresAt" timestamptz(6),
  ADD COLUMN "acceptanceTokenAttempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN "firstPlatformAccessAt" timestamptz(6);

CREATE UNIQUE INDEX "backoffice_adhesions_acceptance_token_hash_key"
  ON "public"."backoffice_adhesions" ("acceptanceTokenHash");
CREATE INDEX "backoffice_adhesions_created_profile_id_idx"
  ON "public"."backoffice_adhesions" ("createdProfileId");
CREATE INDEX "backoffice_adhesions_acceptance_token_expires_at_idx"
  ON "public"."backoffice_adhesions" ("acceptanceTokenExpiresAt");

CREATE TABLE "public"."backoffice_legal_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "type" "public"."BackofficeLegalDocumentType" NOT NULL,
  "version" text NOT NULL,
  "title" text NOT NULL,
  "schemaVersion" integer NOT NULL DEFAULT 1,
  "content" jsonb NOT NULL,
  "contentHash" text NOT NULL,
  "publishedAt" timestamptz(6),
  "createdByBackofficeUserId" uuid,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL,
  CONSTRAINT "backoffice_legal_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_legal_documents_type_version_key" UNIQUE ("type", "version")
);

CREATE TABLE "public"."backoffice_legal_document_sets" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "version" text NOT NULL,
  "schemaVersion" integer NOT NULL DEFAULT 1,
  "termsDocumentId" uuid NOT NULL,
  "privacyDocumentId" uuid NOT NULL,
  "contractDocumentId" uuid NOT NULL,
  "isActive" boolean NOT NULL DEFAULT false,
  "publishedAt" timestamptz(6),
  "createdByBackofficeUserId" uuid,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL,
  CONSTRAINT "backoffice_legal_document_sets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_legal_document_sets_version_key" UNIQUE ("version"),
  CONSTRAINT "backoffice_legal_document_sets_terms_fkey" FOREIGN KEY ("termsDocumentId") REFERENCES "public"."backoffice_legal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT "backoffice_legal_document_sets_privacy_fkey" FOREIGN KEY ("privacyDocumentId") REFERENCES "public"."backoffice_legal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT "backoffice_legal_document_sets_contract_fkey" FOREIGN KEY ("contractDocumentId") REFERENCES "public"."backoffice_legal_documents"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "backoffice_legal_document_sets_one_active_idx"
  ON "public"."backoffice_legal_document_sets" (("isActive")) WHERE "isActive" = true;
CREATE INDEX "backoffice_legal_documents_type_published_at_idx"
  ON "public"."backoffice_legal_documents" ("type", "publishedAt");
CREATE INDEX "backoffice_legal_document_sets_active_published_at_idx"
  ON "public"."backoffice_legal_document_sets" ("isActive", "publishedAt");

CREATE TABLE "public"."backoffice_terms_acceptances" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "adhesionId" uuid NOT NULL,
  "profileId" uuid,
  "documentSetId" uuid NOT NULL,
  "protocol" text NOT NULL,
  "ipAddress" text,
  "userAgent" text NOT NULL,
  "locale" text,
  "acceptedAt" timestamptz(6) NOT NULL,
  "companyLegalName" text NOT NULL,
  "companyTradeName" text,
  "companyCnpj" text NOT NULL,
  "representativeName" text NOT NULL,
  "representativeCpf" text NOT NULL,
  "representativeRole" text NOT NULL,
  "representativeEmail" text NOT NULL,
  "representativeWhatsapp" text NOT NULL,
  "pdfStoragePath" text,
  "pdfSha256" text,
  "pdfGeneratorVersion" text,
  "pdfGeneratedAt" timestamptz(6),
  "emailSentAt" timestamptz(6),
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_terms_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_terms_acceptances_adhesion_key" UNIQUE ("adhesionId"),
  CONSTRAINT "backoffice_terms_acceptances_protocol_key" UNIQUE ("protocol"),
  CONSTRAINT "backoffice_terms_acceptances_adhesion_fkey" FOREIGN KEY ("adhesionId") REFERENCES "public"."backoffice_adhesions"("id") ON DELETE RESTRICT,
  CONSTRAINT "backoffice_terms_acceptances_profile_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT,
  CONSTRAINT "backoffice_terms_acceptances_document_set_fkey" FOREIGN KEY ("documentSetId") REFERENCES "public"."backoffice_legal_document_sets"("id") ON DELETE RESTRICT
);

CREATE TABLE "public"."backoffice_terms_acceptance_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "acceptanceId" uuid NOT NULL,
  "legalDocumentId" uuid NOT NULL,
  "documentType" "public"."BackofficeLegalDocumentType" NOT NULL,
  "documentVersion" text NOT NULL,
  "documentTitle" text NOT NULL,
  "documentSchemaVersion" integer NOT NULL,
  "documentContent" jsonb NOT NULL,
  "documentContentHash" text NOT NULL,
  "documentPublishedAt" timestamptz(6) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_terms_acceptance_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_terms_acceptance_documents_type_key" UNIQUE ("acceptanceId", "documentType"),
  CONSTRAINT "backoffice_terms_acceptance_documents_acceptance_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "public"."backoffice_terms_acceptances"("id") ON DELETE RESTRICT,
  CONSTRAINT "backoffice_terms_acceptance_documents_legal_document_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "public"."backoffice_legal_documents"("id") ON DELETE RESTRICT
);

CREATE TABLE "public"."backoffice_terms_acceptance_outbox" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "acceptanceId" uuid NOT NULL,
  "type" "public"."BackofficeTermsAcceptanceOutboxType" NOT NULL,
  "status" "public"."BackofficeTermsAcceptanceOutboxStatus" NOT NULL DEFAULT 'pending',
  "idempotencyKey" text NOT NULL,
  "payload" jsonb,
  "attempts" integer NOT NULL DEFAULT 0,
  "maxAttempts" integer NOT NULL DEFAULT 8,
  "nextAttemptAt" timestamptz(6) NOT NULL DEFAULT now(),
  "lockedAt" timestamptz(6),
  "completedAt" timestamptz(6),
  "lastError" text,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL,
  CONSTRAINT "backoffice_terms_acceptance_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_terms_acceptance_outbox_idempotency_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "backoffice_terms_acceptance_outbox_acceptance_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "public"."backoffice_terms_acceptances"("id") ON DELETE RESTRICT
);

CREATE INDEX "backoffice_terms_acceptances_profile_id_idx" ON "public"."backoffice_terms_acceptances" ("profileId");
CREATE INDEX "backoffice_terms_acceptances_accepted_at_idx" ON "public"."backoffice_terms_acceptances" ("acceptedAt");
CREATE INDEX "backoffice_terms_acceptance_documents_legal_document_id_idx" ON "public"."backoffice_terms_acceptance_documents" ("legalDocumentId");
CREATE INDEX "backoffice_terms_acceptance_outbox_status_next_idx" ON "public"."backoffice_terms_acceptance_outbox" ("status", "nextAttemptAt");
CREATE INDEX "backoffice_terms_acceptance_outbox_acceptance_id_idx" ON "public"."backoffice_terms_acceptance_outbox" ("acceptanceId");

CREATE OR REPLACE FUNCTION "public"."guard_published_legal_artifacts"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."publishedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'published legal artifacts are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."publishedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'published legal artifacts are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "guard_published_legal_documents"
  BEFORE UPDATE OR DELETE ON "public"."backoffice_legal_documents"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_legal_artifacts"();
CREATE OR REPLACE FUNCTION "public"."guard_published_legal_document_set"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."publishedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'published legal document sets are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."publishedAt" IS NOT NULL THEN
    IF NOT (OLD."isActive" = true AND NEW."isActive" = false
      AND (to_jsonb(NEW) - 'isActive' - 'updatedAt') = (to_jsonb(OLD) - 'isActive' - 'updatedAt')) THEN
      RAISE EXCEPTION 'published legal document sets are immutable';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "guard_published_legal_document_sets"
  BEFORE UPDATE OR DELETE ON "public"."backoffice_legal_document_sets"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_legal_document_set"();

CREATE OR REPLACE FUNCTION "public"."guard_terms_acceptance_evidence"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'terms acceptance evidence is immutable';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."adhesionId" IS DISTINCT FROM OLD."adhesionId"
    OR NEW."profileId" IS DISTINCT FROM OLD."profileId"
    OR NEW."documentSetId" IS DISTINCT FROM OLD."documentSetId"
    OR NEW."protocol" IS DISTINCT FROM OLD."protocol"
    OR NEW."ipAddress" IS DISTINCT FROM OLD."ipAddress"
    OR NEW."userAgent" IS DISTINCT FROM OLD."userAgent"
    OR NEW."locale" IS DISTINCT FROM OLD."locale"
    OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt"
    OR NEW."companyLegalName" IS DISTINCT FROM OLD."companyLegalName"
    OR NEW."companyTradeName" IS DISTINCT FROM OLD."companyTradeName"
    OR NEW."companyCnpj" IS DISTINCT FROM OLD."companyCnpj"
    OR NEW."representativeName" IS DISTINCT FROM OLD."representativeName"
    OR NEW."representativeCpf" IS DISTINCT FROM OLD."representativeCpf"
    OR NEW."representativeRole" IS DISTINCT FROM OLD."representativeRole"
    OR NEW."representativeEmail" IS DISTINCT FROM OLD."representativeEmail"
    OR NEW."representativeWhatsapp" IS DISTINCT FROM OLD."representativeWhatsapp"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'terms acceptance evidence is immutable';
  END IF;
  IF OLD."pdfStoragePath" IS NOT NULL AND NEW."pdfStoragePath" IS DISTINCT FROM OLD."pdfStoragePath" THEN RAISE EXCEPTION 'pdf evidence cannot be replaced'; END IF;
  IF OLD."pdfSha256" IS NOT NULL AND NEW."pdfSha256" IS DISTINCT FROM OLD."pdfSha256" THEN RAISE EXCEPTION 'pdf hash cannot be replaced'; END IF;
  IF OLD."pdfGeneratorVersion" IS NOT NULL AND NEW."pdfGeneratorVersion" IS DISTINCT FROM OLD."pdfGeneratorVersion" THEN RAISE EXCEPTION 'pdf generator cannot be replaced'; END IF;
  IF OLD."pdfGeneratedAt" IS NOT NULL AND NEW."pdfGeneratedAt" IS DISTINCT FROM OLD."pdfGeneratedAt" THEN RAISE EXCEPTION 'pdf date cannot be replaced'; END IF;
  IF OLD."emailSentAt" IS NOT NULL AND NEW."emailSentAt" IS DISTINCT FROM OLD."emailSentAt" THEN RAISE EXCEPTION 'email evidence cannot be replaced'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_terms_acceptances"
  BEFORE UPDATE OR DELETE ON "public"."backoffice_terms_acceptances"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_terms_acceptance_evidence"();
CREATE OR REPLACE FUNCTION "public"."guard_immutable_row"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'row is immutable';
END;
$$;
CREATE TRIGGER "guard_terms_acceptance_documents"
  BEFORE UPDATE OR DELETE ON "public"."backoffice_terms_acceptance_documents"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_immutable_row"();

ALTER TABLE "public"."backoffice_legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_legal_document_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_terms_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_terms_acceptance_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_terms_acceptance_outbox" ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('terms-acceptances', 'terms-acceptances', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
