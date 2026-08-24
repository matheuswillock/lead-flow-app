-- Valida as FKs que 20260824011707 recriou como NOT VALID.
--
-- VALIDATE CONSTRAINT pega SHARE UPDATE EXCLUSIVE: faz um scan da tabela
-- referenciante, mas NÃO bloqueia SELECT/INSERT/UPDATE/DELETE. Por isso está
-- separado do DROP+ADD, que precisa de ACCESS EXCLUSIVE.
--
-- Idempotente: só valida o que ainda estiver NOT VALID.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_oauth_connections_ownerProfileId_fkey'
      AND conrelid = to_regclass('public."google_oauth_connections"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."google_oauth_connections" VALIDATE CONSTRAINT "google_oauth_connections_ownerProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_profiles_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_profiles"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_profiles" VALIDATE CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_users" VALIDATE CONSTRAINT "backoffice_users_googleConnectionId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_linkedCorretorStudioProfileId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_users" VALIDATE CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_receivedByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_createdByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_updatedByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_assignedProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_team_senders_teamId_fkey'
      AND conrelid = to_regclass('public."email_team_senders"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."email_team_senders" VALIDATE CONSTRAINT "email_team_senders_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_sourceTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_targetTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_createdBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_leadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_fromTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_toTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_transferredByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_sentByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_sentByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" VALIDATE CONSTRAINT "whatsapp_usage_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" VALIDATE CONSTRAINT "whatsapp_usage_events_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatches_profileId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatches"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatches" VALIDATE CONSTRAINT "backoffice_email_dispatches_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatch_events_dispatchId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatch_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatch_events" VALIDATE CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_rules_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_rules"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_rules" VALIDATE CONSTRAINT "whatsapp_auto_response_rules_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" VALIDATE CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_ruleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" VALIDATE CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_autoResponseRuleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_contacts_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_contacts"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."team_whatsapp_contacts" VALIDATE CONSTRAINT "team_whatsapp_contacts_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_productId_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" VALIDATE CONSTRAINT "backoffice_adhesions_productId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" VALIDATE CONSTRAINT "whatsapp_outbound_commands_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" VALIDATE CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" VALIDATE CONSTRAINT "whatsapp_webhook_events_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" VALIDATE CONSTRAINT "whatsapp_webhook_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_profiles_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_profiles"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_profiles" VALIDATE CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_identities_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" VALIDATE CONSTRAINT "corretor_studio_radar_identities_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_identities_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" VALIDATE CONSTRAINT "corretor_studio_radar_identities_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" VALIDATE CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" VALIDATE CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" VALIDATE CONSTRAINT "corretor_studio_radar_events_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" VALIDATE CONSTRAINT "corretor_studio_radar_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" VALIDATE CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" VALIDATE CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_actorProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_send_rate_limit_windows_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_send_rate_limit_windows"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" VALIDATE CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_contactId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_contactId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" VALIDATE CONSTRAINT "whatsapp_sync_jobs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" VALIDATE CONSTRAINT "whatsapp_sync_jobs_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_quotedMessageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_quotedMessageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_deletedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_pinnedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_email_campaign_limit_grants_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_email_campaign_limit_grants"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" VALIDATE CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_hit_logs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_hit_logs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" VALIDATE CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_actorProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" VALIDATE CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_discount_approved_by_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" VALIDATE CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_parentId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" VALIDATE CONSTRAINT "corretor_studio_radar_segments_parentId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_sourceCampaignId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" VALIDATE CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_leads_referrerLeadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_leads"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_leads" VALIDATE CONSTRAINT "corretor_studio_leads_referrerLeadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_templates_approvedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" VALIDATE CONSTRAINT "corretor_studio_email_templates_approvedBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_email_templates_rejectedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" VALIDATE CONSTRAINT "corretor_studio_email_templates_rejectedBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_grantId_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" VALIDATE CONSTRAINT "backoffice_feature_grant_teams_grantId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_teamId_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" VALIDATE CONSTRAINT "backoffice_feature_grant_teams_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_updatedByProfileI_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByProfileI_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tags_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tags"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tags" VALIDATE CONSTRAINT "corretor_studio_lead_tags_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_leadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" VALIDATE CONSTRAINT "corretor_studio_lead_tag_assignments_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_tagId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" VALIDATE CONSTRAINT "corretor_studio_lead_tag_assignments_tagId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_leadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" VALIDATE CONSTRAINT "corretor_studio_lead_document_requests_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_createdByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" VALIDATE CONSTRAINT "corretor_studio_lead_document_requests_createdByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_requestId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" VALIDATE CONSTRAINT "corretor_studio_lead_document_request_items_requestId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_attachmentId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" VALIDATE CONSTRAINT "corretor_studio_lead_document_request_items_attachmentId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_radar_outbox_throughput_configs_updatedByProfil_fkey'
      AND conrelid = to_regclass('public."backoffice_radar_outbox_throughput_configs"')
      AND NOT convalidated
  ) THEN
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" VALIDATE CONSTRAINT "backoffice_radar_outbox_throughput_configs_updatedByProfil_fkey";
  END IF;
END $$;

