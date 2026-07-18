-- Bethânia Host Ops — settings singleton, jobs audit, feature seed

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_host_ops_job_type" AS ENUM (
    'APPLY_ENV',
    'RESTART_SERVICE',
    'IMPORT_WORKFLOWS',
    'SYNC_HOST',
    'HEALTH'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_host_ops_job_status" AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "backoffice_bot_host_apply_status" AS ENUM (
    'never',
    'succeeded',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "backoffice_bot_host_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agentBaseUrl" TEXT,
  "agentTokenHash" TEXT,
  "n8nEnvEncrypted" TEXT,
  "evolutionEnvEncrypted" TEXT,
  "desiredHostVersion" TEXT,
  "appliedHostVersion" TEXT,
  "lastAppliedAt" TIMESTAMPTZ(6),
  "lastApplyStatus" "backoffice_bot_host_apply_status" NOT NULL DEFAULT 'never',
  "lastApplyError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_host_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "backoffice_bot_host_ops_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "backoffice_bot_host_ops_job_type" NOT NULL,
  "status" "backoffice_bot_host_ops_job_status" NOT NULL DEFAULT 'queued',
  "payload" JSONB,
  "result" JSONB,
  "errorMessage" TEXT,
  "requestedByProfileId" UUID NOT NULL,
  "startedAt" TIMESTAMPTZ(6),
  "finishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_bot_host_ops_jobs_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "backoffice_bot_host_ops_jobs"
    ADD CONSTRAINT "backoffice_bot_host_ops_jobs_requestedByProfileId_fkey"
    FOREIGN KEY ("requestedByProfileId") REFERENCES "corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "backoffice_bot_host_ops_jobs_status_createdAt_idx"
  ON "backoffice_bot_host_ops_jobs" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "backoffice_bot_host_ops_jobs_requestedBy_createdAt_idx"
  ON "backoffice_bot_host_ops_jobs" ("requestedByProfileId", "createdAt" DESC);

-- Feature: studio-bot-ops (child of studio-bot)
INSERT INTO "public"."backoffice_features" (
  "id", "slug", "name", "accessMode", "defaultAccessLevel",
  "betaEnabled", "sortOrder", "productSlug", "parentId", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'studio-bot-ops',
  'Ops / Host',
  'ADDON',
  'FULL',
  false,
  186,
  'crm',
  parent."id",
  true,
  now(),
  now()
FROM "public"."backoffice_features" parent
WHERE parent."slug" = 'studio-bot'
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'studio-bot-ops';

  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'MANAGER',          'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'OPERATOR',         'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'SDR',              'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CLOSER',           'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal") DO NOTHING;
  END IF;
END $$;
