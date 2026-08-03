-- Radar base import: enum value, dynamic field definitions, background import jobs.

ALTER TYPE "public"."radar_source_type" ADD VALUE IF NOT EXISTS 'base_import';

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_radar_field_definitions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "valueType" text NOT NULL,
  "createdBy" uuid NOT NULL,
  "importJobId" uuid,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corretor_studio_team_radar_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_team_radar_field_definitions_teamId_key_key"
  ON "public"."corretor_studio_team_radar_field_definitions" ("teamId", "key");

CREATE INDEX IF NOT EXISTS "corretor_studio_team_radar_field_definitions_teamId_isActive_idx"
  ON "public"."corretor_studio_team_radar_field_definitions" ("teamId", "isActive");

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_radar_field_definitions"
    ADD CONSTRAINT "corretor_studio_team_radar_field_definitions_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_radar_field_definitions"
    ADD CONSTRAINT "corretor_studio_team_radar_field_definitions_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_radar_import_jobs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "importId" text NOT NULL,
  "teamId" uuid NOT NULL,
  "requestedBy" uuid NOT NULL,
  "baseName" text NOT NULL,
  "sourceFormat" text NOT NULL,
  "storagePath" text NOT NULL,
  "fieldMapping" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "totalRows" integer NOT NULL DEFAULT 0,
  "processedRows" integer NOT NULL DEFAULT 0,
  "createdCount" integer NOT NULL DEFAULT 0,
  "enrichedCount" integer NOT NULL DEFAULT 0,
  "skippedCount" integer NOT NULL DEFAULT 0,
  "deferredCount" integer NOT NULL DEFAULT 0,
  "skippedIssues" jsonb,
  "failedBatches" jsonb,
  "batchSize" integer NOT NULL DEFAULT 500,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corretor_studio_radar_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_radar_import_jobs_importId_key"
  ON "public"."corretor_studio_radar_import_jobs" ("importId");

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_import_jobs_teamId_status_idx"
  ON "public"."corretor_studio_radar_import_jobs" ("teamId", "status");

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_import_jobs_status_createdAt_idx"
  ON "public"."corretor_studio_radar_import_jobs" ("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_radar_import_jobs"
    ADD CONSTRAINT "corretor_studio_radar_import_jobs_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_radar_import_jobs"
    ADD CONSTRAINT "corretor_studio_radar_import_jobs_requestedBy_fkey"
    FOREIGN KEY ("requestedBy") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_radar_field_definitions"
    ADD CONSTRAINT "corretor_studio_team_radar_field_definitions_importJobId_fkey"
    FOREIGN KEY ("importJobId") REFERENCES "public"."corretor_studio_radar_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
