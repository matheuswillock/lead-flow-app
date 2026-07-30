-- FK indexes for whatsapp tables flagged by Supabase advisor
-- All CREATE INDEX are idempotent (IF NOT EXISTS)

-- whatsapp_messages: foreign keys without indexes
CREATE INDEX IF NOT EXISTS "whatsapp_messages_configId_idx"
  ON "public"."whatsapp_messages" ("configId");

CREATE INDEX IF NOT EXISTS "whatsapp_messages_leadId_idx"
  ON "public"."whatsapp_messages" ("leadId");

CREATE INDEX IF NOT EXISTS "whatsapp_messages_deletedByProfileId_idx"
  ON "public"."whatsapp_messages" ("deletedByProfileId");

CREATE INDEX IF NOT EXISTS "whatsapp_messages_autoResponseRuleId_idx"
  ON "public"."whatsapp_messages" ("autoResponseRuleId");

-- whatsapp_conversations: contactId FK
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_contactId_idx"
  ON "public"."whatsapp_conversations" ("contactId");

-- whatsapp_outbound_commands: conversationId FK
CREATE INDEX IF NOT EXISTS "whatsapp_outbound_commands_conversationId_idx"
  ON "public"."whatsapp_outbound_commands" ("conversationId");

-- whatsapp_sync_jobs: configId FK
CREATE INDEX IF NOT EXISTS "whatsapp_sync_jobs_configId_idx"
  ON "public"."whatsapp_sync_jobs" ("configId");

-- whatsapp_webhook_events: teamId FK
CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_teamId_idx"
  ON "public"."whatsapp_webhook_events" ("teamId");

-- whatsapp_message_reactions: profileId FK
CREATE INDEX IF NOT EXISTS "whatsapp_message_reactions_profileId_idx"
  ON "public"."whatsapp_message_reactions" ("profileId");

-- whatsapp_message_favorites: profileId FK
CREATE INDEX IF NOT EXISTS "whatsapp_message_favorites_profileId_idx"
  ON "public"."whatsapp_message_favorites" ("profileId");

-- whatsapp_message_pins: pinnedByProfileId and teamId FKs
CREATE INDEX IF NOT EXISTS "whatsapp_message_pins_pinnedByProfileId_idx"
  ON "public"."whatsapp_message_pins" ("pinnedByProfileId");

CREATE INDEX IF NOT EXISTS "whatsapp_message_pins_teamId_idx"
  ON "public"."whatsapp_message_pins" ("teamId");

-- whatsapp_message_visibility: profileId FK
CREATE INDEX IF NOT EXISTS "whatsapp_message_visibility_profileId_idx"
  ON "public"."whatsapp_message_visibility" ("profileId");

-- whatsapp_message_action_commands: profileId FK
CREATE INDEX IF NOT EXISTS "whatsapp_message_action_commands_profileId_idx"
  ON "public"."whatsapp_message_action_commands" ("profileId");

-- whatsapp_audit_events: actorProfileId FK
CREATE INDEX IF NOT EXISTS "whatsapp_audit_events_actorProfileId_idx"
  ON "public"."whatsapp_audit_events" ("actorProfileId");

-- whatsapp_auto_response_logs: ruleId FK
CREATE INDEX IF NOT EXISTS "whatsapp_auto_response_logs_ruleId_idx"
  ON "public"."whatsapp_auto_response_logs" ("ruleId");

-- team_whatsapp_configs: createdByProfileId and updatedByProfileId FKs
CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_createdByProfileId_idx"
  ON "public"."team_whatsapp_configs" ("createdByProfileId");

CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_updatedByProfileId_idx"
  ON "public"."team_whatsapp_configs" ("updatedByProfileId");

-- whatsapp_contact_identities: contactId FK
CREATE INDEX IF NOT EXISTS "whatsapp_contact_identities_contactId_idx"
  ON "public"."whatsapp_contact_identities" ("contactId");

-- Recreate RLS policies for whatsapp_auto_response_rules using
-- (select auth.uid()) pattern to avoid per-row function evaluation
DROP POLICY IF EXISTS "whatsapp_auto_response_rules_team_member_select" ON "public"."whatsapp_auto_response_rules";
DROP POLICY IF EXISTS "whatsapp_auto_response_rules_team_member_insert" ON "public"."whatsapp_auto_response_rules";
DROP POLICY IF EXISTS "whatsapp_auto_response_rules_team_member_update" ON "public"."whatsapp_auto_response_rules";
DROP POLICY IF EXISTS "whatsapp_auto_response_rules_team_member_delete" ON "public"."whatsapp_auto_response_rules";

CREATE POLICY "whatsapp_auto_response_rules_team_member_select"
  ON "public"."whatsapp_auto_response_rules"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_rules"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_team_member_insert"
  ON "public"."whatsapp_auto_response_rules"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_rules"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_team_member_update"
  ON "public"."whatsapp_auto_response_rules"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_rules"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_rules_team_member_delete"
  ON "public"."whatsapp_auto_response_rules"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_rules"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );

-- Recreate RLS policies for whatsapp_auto_response_logs using
-- (select auth.uid()) pattern
DROP POLICY IF EXISTS "whatsapp_auto_response_logs_team_member_select" ON "public"."whatsapp_auto_response_logs";
DROP POLICY IF EXISTS "whatsapp_auto_response_logs_team_member_insert" ON "public"."whatsapp_auto_response_logs";

CREATE POLICY "whatsapp_auto_response_logs_team_member_select"
  ON "public"."whatsapp_auto_response_logs"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_logs"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_auto_response_logs_team_member_insert"
  ON "public"."whatsapp_auto_response_logs"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = "public"."whatsapp_auto_response_logs"."teamId"
        AND tm."profileId" = (SELECT auth.uid())
    )
  );
