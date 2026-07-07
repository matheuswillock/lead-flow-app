-- Team automation rules + run logs + NotificationType.AUTOMATION_RULE

DO $$ BEGIN
  CREATE TYPE "public"."team_automation_trigger_type" AS ENUM (
    'lead_created',
    'status_changed',
    'lead_idle_in_status',
    'meeting_scheduled',
    'meeting_no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."team_automation_action_type" AS ENUM (
    'send_whatsapp_message',
    'send_email',
    'create_notification',
    'assign_operator'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."team_automation_run_status" AS ENUM (
    'success',
    'failed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'AUTOMATION_RULE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_automation_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" "public"."team_automation_trigger_type" NOT NULL,
  "triggerConfig" JSONB NOT NULL,
  "actionType" "public"."team_automation_action_type" NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_automation_run_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "leadId" UUID,
  "dedupeKey" TEXT NOT NULL,
  "status" "public"."team_automation_run_status" NOT NULL,
  "errorMessage" TEXT,
  "payload" JSONB,
  "executedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_automation_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_team_automation_run_logs_ruleId_leadId_dedupeKey_key"
  ON "public"."corretor_studio_team_automation_run_logs" ("ruleId", "leadId", "dedupeKey");

CREATE INDEX IF NOT EXISTS "corretor_studio_team_automation_rules_teamId_isEnabled_idx"
  ON "public"."corretor_studio_team_automation_rules" ("teamId", "isEnabled");

CREATE INDEX IF NOT EXISTS "corretor_studio_team_automation_rules_teamId_triggerType_isEnabled_idx"
  ON "public"."corretor_studio_team_automation_rules" ("teamId", "triggerType", "isEnabled");

CREATE INDEX IF NOT EXISTS "corretor_studio_team_automation_run_logs_teamId_executedAt_idx"
  ON "public"."corretor_studio_team_automation_run_logs" ("teamId", "executedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_automation_rules"
    ADD CONSTRAINT "corretor_studio_team_automation_rules_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_automation_rules"
    ADD CONSTRAINT "corretor_studio_team_automation_rules_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_automation_run_logs"
    ADD CONSTRAINT "corretor_studio_team_automation_run_logs_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "public"."corretor_studio_team_automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_team_automation_run_logs"
    ADD CONSTRAINT "corretor_studio_team_automation_run_logs_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
