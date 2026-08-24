-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera.
--
-- As migrations históricas criaram as FKs sem cláusula ON UPDATE (= NO ACTION);
-- o Prisma emite ON UPDATE CASCADE por padrão em relação obrigatória. Na prática
-- as duas se comportam igual — as FKs apontam para PK uuid, que nunca é
-- atualizada — mas enquanto os lados discordam, TODA execução de
-- `db:migrate:from-prisma` reescreve as mesmas FKs.
-- Ver §7.5 de docs/audits/prisma-migrations-drift-2026-08-23.md.
--
-- DROP + ADD ... NOT VALID + VALIDATE: o ADD com NOT VALID só toca catálogo
-- (lock curto); o VALIDATE pega SHARE UPDATE EXCLUSIVE e não bloqueia leitura
-- nem escrita. Nenhum dado é reescrito.
--
-- 98 constraints.
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_teamId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_oauth_connections_ownerProfileId_fkey'
      AND conrelid = to_regclass('public."google_oauth_connections"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("ownerProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."google_oauth_connections" DROP CONSTRAINT "google_oauth_connections_ownerProfileId_fkey";
    ALTER TABLE "public"."google_oauth_connections" ADD CONSTRAINT "google_oauth_connections_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."google_oauth_connections" VALIDATE CONSTRAINT "google_oauth_connections_ownerProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_profiles_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_profiles"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_profiles" DROP CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey";
    ALTER TABLE "public"."corretor_studio_profiles" ADD CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_profiles" VALIDATE CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_users" DROP CONSTRAINT "backoffice_users_googleConnectionId_fkey";
    ALTER TABLE "public"."backoffice_users" ADD CONSTRAINT "backoffice_users_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."backoffice_users" VALIDATE CONSTRAINT "backoffice_users_googleConnectionId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_linkedCorretorStudioProfileId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("linkedCorretorStudioProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_users" DROP CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey";
    ALTER TABLE "public"."backoffice_users" ADD CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey" FOREIGN KEY ("linkedCorretorStudioProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."backoffice_users" VALIDATE CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_receivedByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("receivedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey" FOREIGN KEY ("receivedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_createdByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id)'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_updatedByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id)'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    ALTER TABLE "public"."team_whatsapp_configs" VALIDATE CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_teamId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_configId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_leadId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_assignedProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("assignedProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey" FOREIGN KEY ("assignedProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_team_senders_teamId_fkey'
      AND conrelid = to_regclass('public."email_team_senders"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."email_team_senders" DROP CONSTRAINT "email_team_senders_teamId_fkey";
    ALTER TABLE "public"."email_team_senders" ADD CONSTRAINT "email_team_senders_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."email_team_senders" VALIDATE CONSTRAINT "email_team_senders_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_sourceTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sourceTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_targetTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("targetTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_createdBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" VALIDATE CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_leadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_fromTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("fromTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_toTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("toTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_transferredByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("transferredByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey" FOREIGN KEY ("transferredByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_transfers" VALIDATE CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_teamId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_configId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_leadId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_sentByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sentByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_sentByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sentByProfileId_fkey" FOREIGN KEY ("sentByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_sentByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" DROP CONSTRAINT "whatsapp_usage_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_usage_events" ADD CONSTRAINT "whatsapp_usage_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_usage_events" VALIDATE CONSTRAINT "whatsapp_usage_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" DROP CONSTRAINT "whatsapp_usage_events_configId_fkey";
    ALTER TABLE "public"."whatsapp_usage_events" ADD CONSTRAINT "whatsapp_usage_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_usage_events" VALIDATE CONSTRAINT "whatsapp_usage_events_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatches_profileId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatches"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatches" DROP CONSTRAINT "backoffice_email_dispatches_profileId_fkey";
    ALTER TABLE "public"."backoffice_email_dispatches" ADD CONSTRAINT "backoffice_email_dispatches_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."backoffice_email_dispatches" VALIDATE CONSTRAINT "backoffice_email_dispatches_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatch_events_dispatchId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatch_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("dispatchId") REFERENCES backoffice_email_dispatches(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatch_events" DROP CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey";
    ALTER TABLE "public"."backoffice_email_dispatch_events" ADD CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES backoffice_email_dispatches(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."backoffice_email_dispatch_events" VALIDATE CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_rules_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_rules"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_rules" DROP CONSTRAINT "whatsapp_auto_response_rules_configId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_rules" ADD CONSTRAINT "whatsapp_auto_response_rules_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_auto_response_rules" VALIDATE CONSTRAINT "whatsapp_auto_response_rules_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" DROP CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_logs" ADD CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_auto_response_logs" VALIDATE CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_ruleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("ruleId") REFERENCES whatsapp_auto_response_rules(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" DROP CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_logs" ADD CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES whatsapp_auto_response_rules(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_auto_response_logs" VALIDATE CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_autoResponseRuleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("autoResponseRuleId") REFERENCES whatsapp_auto_response_rules(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey" FOREIGN KEY ("autoResponseRuleId") REFERENCES whatsapp_auto_response_rules(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_contacts_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_contacts"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_contacts" DROP CONSTRAINT "team_whatsapp_contacts_teamId_fkey";
    ALTER TABLE "public"."team_whatsapp_contacts" ADD CONSTRAINT "team_whatsapp_contacts_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."team_whatsapp_contacts" VALIDATE CONSTRAINT "team_whatsapp_contacts_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_productId_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" DROP CONSTRAINT "backoffice_adhesions_productId_fkey";
    ALTER TABLE "public"."backoffice_adhesions" ADD CONSTRAINT "backoffice_adhesions_productId_fkey" FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."backoffice_adhesions" VALIDATE CONSTRAINT "backoffice_adhesions_productId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" DROP CONSTRAINT "whatsapp_outbound_commands_teamId_fkey";
    ALTER TABLE "public"."whatsapp_outbound_commands" ADD CONSTRAINT "whatsapp_outbound_commands_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_outbound_commands" VALIDATE CONSTRAINT "whatsapp_outbound_commands_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" DROP CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_outbound_commands" ADD CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_outbound_commands" VALIDATE CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" DROP CONSTRAINT "whatsapp_webhook_events_configId_fkey";
    ALTER TABLE "public"."whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_webhook_events" VALIDATE CONSTRAINT "whatsapp_webhook_events_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" DROP CONSTRAINT "whatsapp_webhook_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_webhook_events" VALIDATE CONSTRAINT "whatsapp_webhook_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_profiles_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_profiles"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_profiles" DROP CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_profiles" ADD CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_profiles" VALIDATE CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_identities_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" DROP CONSTRAINT "corretor_studio_radar_identities_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_identities" ADD CONSTRAINT "corretor_studio_radar_identities_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_identities" VALIDATE CONSTRAINT "corretor_studio_radar_identities_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_identities_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" DROP CONSTRAINT "corretor_studio_radar_identities_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_identities" ADD CONSTRAINT "corretor_studio_radar_identities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_identities" VALIDATE CONSTRAINT "corretor_studio_radar_identities_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" DROP CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_source_links" ADD CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_source_links" VALIDATE CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" DROP CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_source_links" ADD CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_source_links" VALIDATE CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" DROP CONSTRAINT "corretor_studio_radar_events_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_events" ADD CONSTRAINT "corretor_studio_radar_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_events" VALIDATE CONSTRAINT "corretor_studio_radar_events_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" DROP CONSTRAINT "corretor_studio_radar_events_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_events" ADD CONSTRAINT "corretor_studio_radar_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_events" VALIDATE CONSTRAINT "corretor_studio_radar_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" DROP CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" ADD CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" VALIDATE CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" DROP CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" ADD CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" VALIDATE CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_actorProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_audit_events" VALIDATE CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_send_rate_limit_windows_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_send_rate_limit_windows"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" DROP CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey";
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" ADD CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" VALIDATE CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_contactId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_conversations" VALIDATE CONSTRAINT "whatsapp_conversations_contactId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_teamId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_configId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_contactId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_contact_identities" VALIDATE CONSTRAINT "whatsapp_contact_identities_contactId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" DROP CONSTRAINT "whatsapp_sync_jobs_teamId_fkey";
    ALTER TABLE "public"."whatsapp_sync_jobs" ADD CONSTRAINT "whatsapp_sync_jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_sync_jobs" VALIDATE CONSTRAINT "whatsapp_sync_jobs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" DROP CONSTRAINT "whatsapp_sync_jobs_configId_fkey";
    ALTER TABLE "public"."whatsapp_sync_jobs" ADD CONSTRAINT "whatsapp_sync_jobs_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_sync_jobs" VALIDATE CONSTRAINT "whatsapp_sync_jobs_configId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_quotedMessageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("quotedMessageId") REFERENCES whatsapp_messages(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_quotedMessageId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_quotedMessageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_deletedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("deletedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey" FOREIGN KEY ("deletedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."whatsapp_message_reactions" VALIDATE CONSTRAINT "whatsapp_message_reactions_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_favorites" VALIDATE CONSTRAINT "whatsapp_message_favorites_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_conversationId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_pinnedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("pinnedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey" FOREIGN KEY ("pinnedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_pins" VALIDATE CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_visibility" VALIDATE CONSTRAINT "whatsapp_message_visibility_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_messageId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."whatsapp_message_action_commands" VALIDATE CONSTRAINT "whatsapp_message_action_commands_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_email_campaign_limit_grants_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_email_campaign_limit_grants"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" DROP CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" ADD CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" VALIDATE CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_hit_logs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_hit_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" DROP CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" ADD CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" VALIDATE CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_actorProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" DROP CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" ADD CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" VALIDATE CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_discount_approved_by_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("discountApprovedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" DROP CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey";
    ALTER TABLE "public"."backoffice_adhesions" ADD CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey" FOREIGN KEY ("discountApprovedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."backoffice_adhesions" VALIDATE CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_parentId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("parentId") REFERENCES corretor_studio_radar_segments(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" DROP CONSTRAINT "corretor_studio_radar_segments_parentId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_segments" ADD CONSTRAINT "corretor_studio_radar_segments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES corretor_studio_radar_segments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_segments" VALIDATE CONSTRAINT "corretor_studio_radar_segments_parentId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_sourceCampaignId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sourceCampaignId") REFERENCES corretor_studio_email_campaigns(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" DROP CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_segments" ADD CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey" FOREIGN KEY ("sourceCampaignId") REFERENCES corretor_studio_email_campaigns(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_radar_segments" VALIDATE CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_leads_referrer_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_leads"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("referrerLeadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_leads" DROP CONSTRAINT "corretor_studio_leads_referrer_lead_fkey";
    ALTER TABLE "public"."corretor_studio_leads" ADD CONSTRAINT "corretor_studio_leads_referrerLeadId_fkey" FOREIGN KEY ("referrerLeadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_leads" VALIDATE CONSTRAINT "corretor_studio_leads_referrerLeadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_template_approvedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("approvedBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" DROP CONSTRAINT "email_template_approvedBy_fkey";
    ALTER TABLE "public"."corretor_studio_email_templates" ADD CONSTRAINT "corretor_studio_email_templates_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_email_templates" VALIDATE CONSTRAINT "corretor_studio_email_templates_approvedBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_template_rejectedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("rejectedBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" DROP CONSTRAINT "email_template_rejectedBy_fkey";
    ALTER TABLE "public"."corretor_studio_email_templates" ADD CONSTRAINT "corretor_studio_email_templates_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_email_templates" VALIDATE CONSTRAINT "corretor_studio_email_templates_rejectedBy_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_grant_id_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("grantId") REFERENCES backoffice_feature_grants(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" DROP CONSTRAINT "backoffice_feature_grant_teams_grant_id_fkey";
    ALTER TABLE "public"."backoffice_feature_grant_teams" ADD CONSTRAINT "backoffice_feature_grant_teams_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES backoffice_feature_grants(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."backoffice_feature_grant_teams" VALIDATE CONSTRAINT "backoffice_feature_grant_teams_grantId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_team_id_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" DROP CONSTRAINT "backoffice_feature_grant_teams_team_id_fkey";
    ALTER TABLE "public"."backoffice_feature_grant_teams" ADD CONSTRAINT "backoffice_feature_grant_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."backoffice_feature_grant_teams" VALIDATE CONSTRAINT "backoffice_feature_grant_teams_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_updatedByPId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE RESTRICT'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByPId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByProfileI_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" VALIDATE CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByProfileI_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tags_team_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tags"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tags" DROP CONSTRAINT "corretor_studio_lead_tags_team_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tags" ADD CONSTRAINT "corretor_studio_lead_tags_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_tags" VALIDATE CONSTRAINT "corretor_studio_lead_tags_teamId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" DROP CONSTRAINT "corretor_studio_lead_tag_assignments_lead_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" ADD CONSTRAINT "corretor_studio_lead_tag_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" VALIDATE CONSTRAINT "corretor_studio_lead_tag_assignments_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_tag_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("tagId") REFERENCES corretor_studio_lead_tags(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" DROP CONSTRAINT "corretor_studio_lead_tag_assignments_tag_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" ADD CONSTRAINT "corretor_studio_lead_tag_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES corretor_studio_lead_tags(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" VALIDATE CONSTRAINT "corretor_studio_lead_tag_assignments_tagId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" DROP CONSTRAINT "corretor_studio_lead_document_requests_lead_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_requests" ADD CONSTRAINT "corretor_studio_lead_document_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_document_requests" VALIDATE CONSTRAINT "corretor_studio_lead_document_requests_leadId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_creator_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" DROP CONSTRAINT "corretor_studio_lead_document_requests_creator_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_requests" ADD CONSTRAINT "corretor_studio_lead_document_requests_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_document_requests" VALIDATE CONSTRAINT "corretor_studio_lead_document_requests_createdByProfileId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_request_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("requestId") REFERENCES corretor_studio_lead_document_requests(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" DROP CONSTRAINT "corretor_studio_lead_document_request_items_request_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" ADD CONSTRAINT "corretor_studio_lead_document_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES corretor_studio_lead_document_requests(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" VALIDATE CONSTRAINT "corretor_studio_lead_document_request_items_requestId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_attachment_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("attachmentId") REFERENCES corretor_studio_lead_attachments(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" DROP CONSTRAINT "corretor_studio_lead_document_request_items_attachment_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" ADD CONSTRAINT "corretor_studio_lead_document_request_items_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES corretor_studio_lead_attachments(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" VALIDATE CONSTRAINT "corretor_studio_lead_document_request_items_attachmentId_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_radar_outbox_throughput_configs_updated_by_fkey'
      AND conrelid = to_regclass('public."backoffice_radar_outbox_throughput_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" DROP CONSTRAINT "backoffice_radar_outbox_throughput_configs_updated_by_fkey";
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" ADD CONSTRAINT "backoffice_radar_outbox_throughput_configs_updatedByProfil_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" VALIDATE CONSTRAINT "backoffice_radar_outbox_throughput_configs_updatedByProfil_fkey";
  END IF;
END $$;

