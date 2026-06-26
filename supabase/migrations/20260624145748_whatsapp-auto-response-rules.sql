-- Migration: whatsapp-auto-response-rules
-- Auto-response rules, logs, conversation handoff fields, realtime publication, RLS

-- Enums
DO $$ BEGIN
  CREATE TYPE "WhatsAppHandoffMode" AS ENUM ('BOT', 'HUMAN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppAutoResponseRuleType" AS ENUM ('WELCOME', 'OFF_HOURS', 'KEYWORD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppAutoResponseMatchMode" AS ENUM ('CONTAINS', 'EXACT', 'STARTS_WITH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Conversation handoff fields
ALTER TABLE "whatsapp_conversations"
  ADD COLUMN IF NOT EXISTS "handoffMode" "WhatsAppHandoffMode" NOT NULL DEFAULT 'BOT',
  ADD COLUMN IF NOT EXISTS "welcomeSentAt" TIMESTAMPTZ;

-- Message auto-response fields
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "isAutoResponse" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoResponseRuleId" UUID;

-- Auto-response rules
CREATE TABLE IF NOT EXISTS "whatsapp_auto_response_rules" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "configId"         UUID        NOT NULL,
    "type"             "WhatsAppAutoResponseRuleType" NOT NULL,
    "replyMessage"     TEXT        NOT NULL,
    "triggerKeywords"  TEXT[]      NOT NULL DEFAULT '{}',
    "matchMode"        "WhatsAppAutoResponseMatchMode" NOT NULL DEFAULT 'CONTAINS',
    "offHoursSchedule" JSONB,
    "isActive"         BOOLEAN     NOT NULL DEFAULT false,
    "priority"         INTEGER     NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_auto_response_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "whatsapp_auto_response_rules_configId_type_isActive_idx"
    ON "whatsapp_auto_response_rules" ("configId", "type", "isActive");

ALTER TABLE "whatsapp_auto_response_rules"
    DROP CONSTRAINT IF EXISTS "whatsapp_auto_response_rules_configId_fkey";

ALTER TABLE "whatsapp_auto_response_rules"
    ADD CONSTRAINT "whatsapp_auto_response_rules_configId_fkey"
        FOREIGN KEY ("configId") REFERENCES "team_whatsapp_configs" ("id") ON DELETE CASCADE;

-- Auto-response logs
CREATE TABLE IF NOT EXISTS "whatsapp_auto_response_logs" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "conversationId"    UUID        NOT NULL,
    "ruleId"            UUID,
    "ruleType"          "WhatsAppAutoResponseRuleType" NOT NULL,
    "inboundMessageId"  UUID,
    "outboundMessageId" UUID,
    "triggerText"       TEXT,
    "sentText"          TEXT        NOT NULL,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_auto_response_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "whatsapp_auto_response_logs_conversationId_ruleType_createdAt_idx"
    ON "whatsapp_auto_response_logs" ("conversationId", "ruleType", "createdAt");

ALTER TABLE "whatsapp_auto_response_logs"
    DROP CONSTRAINT IF EXISTS "whatsapp_auto_response_logs_conversationId_fkey";

ALTER TABLE "whatsapp_auto_response_logs"
    ADD CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations" ("id") ON DELETE CASCADE;

ALTER TABLE "whatsapp_auto_response_logs"
    DROP CONSTRAINT IF EXISTS "whatsapp_auto_response_logs_ruleId_fkey";

ALTER TABLE "whatsapp_auto_response_logs"
    ADD CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey"
        FOREIGN KEY ("ruleId") REFERENCES "whatsapp_auto_response_rules" ("id") ON DELETE SET NULL;

ALTER TABLE "whatsapp_messages"
    DROP CONSTRAINT IF EXISTS "whatsapp_messages_autoResponseRuleId_fkey";

ALTER TABLE "whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey"
        FOREIGN KEY ("autoResponseRuleId") REFERENCES "whatsapp_auto_response_rules" ("id") ON DELETE SET NULL;

-- Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS for auto-response tables (team-scoped via config)
ALTER TABLE "public"."whatsapp_auto_response_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."whatsapp_auto_response_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_auto_response_rules_select" ON "public"."whatsapp_auto_response_rules"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."team_whatsapp_configs" c
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = c."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE c.id = "whatsapp_auto_response_rules"."configId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_insert" ON "public"."whatsapp_auto_response_rules"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."team_whatsapp_configs" c
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = c."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE c.id = "whatsapp_auto_response_rules"."configId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_update" ON "public"."whatsapp_auto_response_rules"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."team_whatsapp_configs" c
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = c."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE c.id = "whatsapp_auto_response_rules"."configId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_delete" ON "public"."whatsapp_auto_response_rules"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."team_whatsapp_configs" c
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = c."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE c.id = "whatsapp_auto_response_rules"."configId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_logs_select" ON "public"."whatsapp_auto_response_logs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."whatsapp_conversations" conv
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = conv."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE conv.id = "whatsapp_auto_response_logs"."conversationId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );
