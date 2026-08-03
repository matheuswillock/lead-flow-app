-- Migration: crm-tags-contacts-doc-requests
-- Adds: LeadTag, LeadTagAssignment, LeadDocumentRequest, LeadDocumentRequestItem
-- Extends: ActivityType enum, LeadActivity (contact fields), NotificationType enum

-- ==============================
-- 1. Extend ActivityType enum
-- ==============================
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'visit';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'missed';

-- ==============================
-- 2. Extend NotificationType enum
-- ==============================
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LEAD_DOCUMENT_UPLOADED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LEAD_DOCUMENT_REQUEST_COMPLETED';

-- ==============================
-- 3. Extend LeadActivity with contact fields
-- ==============================
ALTER TABLE "corretor_studio_lead_activities"
  ADD COLUMN IF NOT EXISTS "outcome" TEXT,
  ADD COLUMN IF NOT EXISTS "duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "contactDate" DATE,
  ADD COLUMN IF NOT EXISTS "contactTime" TEXT;

-- Index for contact-type filtering
CREATE INDEX IF NOT EXISTS "corretor_studio_lead_activities_lead_id_type_idx"
  ON "corretor_studio_lead_activities" ("leadId", "type");

-- ==============================
-- 4. LeadTag (team-scoped tags for leads)
-- ==============================
CREATE TABLE IF NOT EXISTS "corretor_studio_lead_tags" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "teamId"    UUID         NOT NULL,
  "name"      TEXT         NOT NULL,
  "color"     TEXT         NOT NULL,
  "sortOrder" INTEGER      NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "corretor_studio_lead_tags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_lead_tags_team_name_key" UNIQUE ("teamId", "name"),
  CONSTRAINT "corretor_studio_lead_tags_team_fkey"
    FOREIGN KEY ("teamId")
    REFERENCES "corretor_studio_teams" ("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_tags_team_sort_idx"
  ON "corretor_studio_lead_tags" ("teamId", "sortOrder");

-- ==============================
-- 5. LeadTagAssignment (N:N lead <-> tag)
-- ==============================
CREATE TABLE IF NOT EXISTS "corretor_studio_lead_tag_assignments" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "leadId"    UUID        NOT NULL,
  "tagId"     UUID        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "corretor_studio_lead_tag_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_lead_tag_assignments_lead_tag_key" UNIQUE ("leadId", "tagId"),
  CONSTRAINT "corretor_studio_lead_tag_assignments_lead_fkey"
    FOREIGN KEY ("leadId")
    REFERENCES "corretor_studio_leads" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_tag_assignments_tag_fkey"
    FOREIGN KEY ("tagId")
    REFERENCES "corretor_studio_lead_tags" ("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_tag_assignments_tag_idx"
  ON "corretor_studio_lead_tag_assignments" ("tagId");

-- ==============================
-- 6. LeadDocumentRequestStatus enum
-- ==============================
DO $$ BEGIN
  CREATE TYPE "lead_document_request_status" AS ENUM ('pending', 'partially_filled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================
-- 7. LeadDocumentRequest
-- ==============================
CREATE TABLE IF NOT EXISTS "corretor_studio_lead_document_requests" (
  "id"                 UUID                          NOT NULL DEFAULT gen_random_uuid(),
  "leadId"             UUID                          NOT NULL,
  "teamId"             UUID                          NOT NULL,
  "createdByProfileId" UUID                          NOT NULL,
  "publicToken"        TEXT                          NOT NULL,
  "message"            TEXT,
  "status"             "lead_document_request_status" NOT NULL DEFAULT 'pending',
  "lastEmailSentAt"    TIMESTAMPTZ,
  "completedAt"        TIMESTAMPTZ,
  "createdAt"          TIMESTAMPTZ                   NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ                   NOT NULL DEFAULT now(),

  CONSTRAINT "corretor_studio_lead_document_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_lead_document_requests_token_key" UNIQUE ("publicToken"),
  CONSTRAINT "corretor_studio_lead_document_requests_lead_fkey"
    FOREIGN KEY ("leadId")
    REFERENCES "corretor_studio_leads" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_document_requests_creator_fkey"
    FOREIGN KEY ("createdByProfileId")
    REFERENCES "corretor_studio_profiles" ("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_document_requests_lead_idx"
  ON "corretor_studio_lead_document_requests" ("leadId");
CREATE INDEX IF NOT EXISTS "corretor_studio_lead_document_requests_team_idx"
  ON "corretor_studio_lead_document_requests" ("teamId");
CREATE INDEX IF NOT EXISTS "corretor_studio_lead_document_requests_token_idx"
  ON "corretor_studio_lead_document_requests" ("publicToken");
CREATE INDEX IF NOT EXISTS "corretor_studio_lead_document_requests_status_email_idx"
  ON "corretor_studio_lead_document_requests" ("status", "lastEmailSentAt");

-- ==============================
-- 8. LeadDocumentRequestItem
-- ==============================
CREATE TABLE IF NOT EXISTS "corretor_studio_lead_document_request_items" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "requestId"    UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "description"  TEXT,
  "isRequired"   BOOLEAN     NOT NULL DEFAULT true,
  "attachmentId" UUID,
  "uploadedAt"   TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "corretor_studio_lead_document_request_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_lead_document_request_items_request_fkey"
    FOREIGN KEY ("requestId")
    REFERENCES "corretor_studio_lead_document_requests" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_document_request_items_attachment_fkey"
    FOREIGN KEY ("attachmentId")
    REFERENCES "corretor_studio_lead_attachments" ("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_document_request_items_request_idx"
  ON "corretor_studio_lead_document_request_items" ("requestId");
