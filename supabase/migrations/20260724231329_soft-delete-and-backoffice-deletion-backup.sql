-- Soft-delete em Lead/Team/Profile + tabelas Backoffice de deleção/aprovação/backup.
-- Idempotente.

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_deletion_entity_type" AS ENUM ('LEAD', 'TEAM', 'PROFILE', 'TEAM_MEMBERSHIP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_deletion_request_type" AS ENUM ('USER_DELETE', 'TEAM_DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_deletion_request_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_deletion_approval_decision" AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_database_backup_status" AS ENUM ('pending', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "deletedByProfileId" UUID;

ALTER TABLE "public"."corretor_studio_leads"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "deletedByProfileId" UUID;

ALTER TABLE "public"."corretor_studio_teams"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "deletedByProfileId" UUID;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_profiles"
    ADD CONSTRAINT "corretor_studio_profiles_deletedByProfileId_fkey"
    FOREIGN KEY ("deletedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_leads"
    ADD CONSTRAINT "corretor_studio_leads_deletedByProfileId_fkey"
    FOREIGN KEY ("deletedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_teams"
    ADD CONSTRAINT "corretor_studio_teams_deletedByProfileId_fkey"
    FOREIGN KEY ("deletedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_profiles_deletedAt_idx"
  ON "public"."corretor_studio_profiles"("deletedAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_leads_deletedAt_idx"
  ON "public"."corretor_studio_leads"("deletedAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_teams_deletedAt_idx"
  ON "public"."corretor_studio_teams"("deletedAt");

CREATE TABLE IF NOT EXISTS "public"."backoffice_deletion_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "public"."backoffice_deletion_request_type" NOT NULL,
  "targetId" UUID NOT NULL,
  "requestedByProfileId" UUID NOT NULL,
  "status" "public"."backoffice_deletion_request_status" NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "executedAt" TIMESTAMPTZ(6),
  CONSTRAINT "backoffice_deletion_requests_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_deletion_requests"
    ADD CONSTRAINT "backoffice_deletion_requests_requestedByProfileId_fkey"
    FOREIGN KEY ("requestedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "backoffice_deletion_requests_status_createdAt_idx"
  ON "public"."backoffice_deletion_requests"("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_deletion_requests_type_targetId_idx"
  ON "public"."backoffice_deletion_requests"("type", "targetId");

CREATE INDEX IF NOT EXISTS "backoffice_deletion_requests_requestedByProfileId_idx"
  ON "public"."backoffice_deletion_requests"("requestedByProfileId");

CREATE TABLE IF NOT EXISTS "public"."backoffice_deletion_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "approverProfileId" UUID NOT NULL,
  "decision" "public"."backoffice_deletion_approval_decision" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_deletion_approvals_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_deletion_approvals"
    ADD CONSTRAINT "backoffice_deletion_approvals_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "public"."backoffice_deletion_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_deletion_approvals"
    ADD CONSTRAINT "backoffice_deletion_approvals_approverProfileId_fkey"
    FOREIGN KEY ("approverProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_deletion_approvals_requestId_approverProfileId_key"
  ON "public"."backoffice_deletion_approvals"("requestId", "approverProfileId");

CREATE INDEX IF NOT EXISTS "backoffice_deletion_approvals_approverProfileId_idx"
  ON "public"."backoffice_deletion_approvals"("approverProfileId");

CREATE TABLE IF NOT EXISTS "public"."backoffice_deletion_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entityType" "public"."backoffice_deletion_entity_type" NOT NULL,
  "entityId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "actorProfileId" UUID,
  "requestId" UUID,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_deletion_audit_logs_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_deletion_audit_logs"
    ADD CONSTRAINT "backoffice_deletion_audit_logs_actorProfileId_fkey"
    FOREIGN KEY ("actorProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_deletion_audit_logs"
    ADD CONSTRAINT "backoffice_deletion_audit_logs_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "public"."backoffice_deletion_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "backoffice_deletion_audit_logs_entity_idx"
  ON "public"."backoffice_deletion_audit_logs"("entityType", "entityId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_deletion_audit_logs_actorProfileId_idx"
  ON "public"."backoffice_deletion_audit_logs"("actorProfileId");

CREATE INDEX IF NOT EXISTS "backoffice_deletion_audit_logs_requestId_idx"
  ON "public"."backoffice_deletion_audit_logs"("requestId");

CREATE TABLE IF NOT EXISTS "public"."backoffice_database_backups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "finishedAt" TIMESTAMPTZ(6),
  "status" "public"."backoffice_database_backup_status" NOT NULL DEFAULT 'pending',
  "filePath" TEXT,
  "fileName" TEXT,
  "sizeBytes" BIGINT,
  "checksumSha256" TEXT,
  "storageSyncPath" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_database_backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backoffice_database_backups_status_startedAt_idx"
  ON "public"."backoffice_database_backups"("status", "startedAt" DESC);

ALTER TABLE "public"."backoffice_deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_deletion_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_deletion_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backoffice_database_backups" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "backoffice_deletion_requests_service_role_all"
    ON "public"."backoffice_deletion_requests" FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_deletion_approvals_service_role_all"
    ON "public"."backoffice_deletion_approvals" FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_deletion_audit_logs_service_role_all"
    ON "public"."backoffice_deletion_audit_logs" FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_database_backups_service_role_all"
    ON "public"."backoffice_database_backups" FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
