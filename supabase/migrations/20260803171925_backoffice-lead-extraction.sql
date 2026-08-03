-- Migration: backoffice-lead-extraction
-- Creates tables for the backoffice lead extraction tool (CNPJá integration)

CREATE TYPE "public"."backoffice_lead_extraction_status" AS ENUM (
  'PENDING',
  'RUNNING',
  'DONE',
  'ERROR'
);

CREATE TABLE IF NOT EXISTS "public"."backoffice_lead_extractions" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profileId"  UUID        NOT NULL,
  "filters"    JSONB       NOT NULL DEFAULT '{}',
  "totalCount" INTEGER     NOT NULL DEFAULT 0,
  "status"     "public"."backoffice_lead_extraction_status" NOT NULL DEFAULT 'PENDING',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "backoffice_lead_extractions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_lead_extractions_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "backoffice_lead_extractions_profileId_createdAt_idx"
  ON "public"."backoffice_lead_extractions" ("profileId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "public"."backoffice_lead_extraction_results" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "extractionId" UUID        NOT NULL,
  "taxId"        TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "tradeName"    TEXT,
  "email"        TEXT,
  "phone"        TEXT,
  "city"         TEXT,
  "state"        TEXT,
  "cnae"         TEXT,
  "cnaeName"     TEXT,
  "type"         TEXT,
  "raw"          JSONB,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "backoffice_lead_extraction_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_lead_extraction_results_extractionId_fkey"
    FOREIGN KEY ("extractionId") REFERENCES "public"."backoffice_lead_extractions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "backoffice_lead_extraction_results_extractionId_idx"
  ON "public"."backoffice_lead_extraction_results" ("extractionId");
