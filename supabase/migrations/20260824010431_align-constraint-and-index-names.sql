-- Alinha os nomes físicos de constraints e índices com os que o Prisma gera.
--
-- As migrations históricas nomearam esses objetos em snake_case ou tudo em
-- minúsculas (backoffice_contracts_clientid_fkey, public_forms_team_status_updated_idx);
-- o Prisma gera a partir do nome do campo (backoffice_contracts_clientId_fkey,
-- corretor_studio_public_forms_teamId_status_updatedAt_idx). Enquanto os dois
-- lados discordam, TODA execução de `db:migrate:from-prisma` reescreve os mesmos
-- ~220 objetos. Ver §6 e §7.4 de docs/audits/prisma-migrations-drift-2026-08-23.md.
--
-- RENAME e não DROP/CREATE: o `supabase db diff` propõe recriar os objetos.
-- RENAME é operação de catálogo — não relê a tabela, não reconstrói o índice
-- e não valida FK de novo.
--
-- Escopo: SÓ pares com definição idêntica nos dois lados. Constraints cuja
-- definição também diverge (ON UPDATE) NÃO entram aqui — ver o relatório.
--
-- 18 constraints + 101 índices.
-- Idempotente: cada rename exige o nome antigo presente e o novo ausente.

-- 1. Constraints (o índice de suporte é renomeado junto) --------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_team_transfer_routes_source_target_unique' AND conrelid = to_regclass('public.corretor_studio_team_transfer_routes'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_team_transfer_routes_sourceTeamId_targetTea_key' AND conrelid = to_regclass('public.corretor_studio_team_transfer_routes')) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" RENAME CONSTRAINT "corretor_studio_team_transfer_routes_source_target_unique" TO "corretor_studio_team_transfer_routes_sourceTeamId_targetTea_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_lead_status_transition_field_rules_updatedByProfileI' AND conrelid = to_regclass('public.backoffice_lead_status_transition_field_rules'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_lead_status_transition_field_rules_updatedByPro_fkey' AND conrelid = to_regclass('public.backoffice_lead_status_transition_field_rules')) THEN
    ALTER TABLE "public"."backoffice_lead_status_transition_field_rules" RENAME CONSTRAINT "backoffice_lead_status_transition_field_rules_updatedByProfileI" TO "backoffice_lead_status_transition_field_rules_updatedByPro_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_required_documents_reviewedByProfileId_fke' AND conrelid = to_regclass('public.corretor_studio_lead_required_documents'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_required_documents_reviewedByProfileI_fkey' AND conrelid = to_regclass('public.corretor_studio_lead_required_documents')) THEN
    ALTER TABLE "public"."corretor_studio_lead_required_documents" RENAME CONSTRAINT "corretor_studio_lead_required_documents_reviewedByProfileId_fke" TO "corretor_studio_lead_required_documents_reviewedByProfileI_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_clientid_fkey' AND conrelid = to_regclass('public.backoffice_contracts'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_clientId_fkey' AND conrelid = to_regclass('public.backoffice_contracts')) THEN
    ALTER TABLE "public"."backoffice_contracts" RENAME CONSTRAINT "backoffice_contracts_clientid_fkey" TO "backoffice_contracts_clientId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_createdbyprofileid_fkey' AND conrelid = to_regclass('public.backoffice_contracts'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_createdByProfileId_fkey' AND conrelid = to_regclass('public.backoffice_contracts')) THEN
    ALTER TABLE "public"."backoffice_contracts" RENAME CONSTRAINT "backoffice_contracts_createdbyprofileid_fkey" TO "backoffice_contracts_createdByProfileId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_contractid_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_contractId_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions')) THEN
    ALTER TABLE "public"."backoffice_contract_versions" RENAME CONSTRAINT "backoffice_contract_versions_contractid_fkey" TO "backoffice_contract_versions_contractId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_importedbyprofileid_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_importedByProfileId_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions')) THEN
    ALTER TABLE "public"."backoffice_contract_versions" RENAME CONSTRAINT "backoffice_contract_versions_importedbyprofileid_fkey" TO "backoffice_contract_versions_importedByProfileId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_sharegeneratedbyprofileid_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_shareGeneratedByProfileId_fkey' AND conrelid = to_regclass('public.backoffice_contract_versions')) THEN
    ALTER TABLE "public"."backoffice_contract_versions" RENAME CONSTRAINT "backoffice_contract_versions_sharegeneratedbyprofileid_fkey" TO "backoffice_contract_versions_shareGeneratedByProfileId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_public_form_eligible_close_formId_profileId_key' AND conrelid = to_regclass('public.corretor_studio_public_form_eligible_closers'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_public_form_eligible_closers_formId_profile_key' AND conrelid = to_regclass('public.corretor_studio_public_form_eligible_closers')) THEN
    ALTER TABLE "public"."corretor_studio_public_form_eligible_closers" RENAME CONSTRAINT "corretor_studio_public_form_eligible_close_formId_profileId_key" TO "corretor_studio_public_form_eligible_closers_formId_profile_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_crm_lead_status_transition_gates_updatedByProfileId_' AND conrelid = to_regclass('public.backoffice_crm_lead_status_transition_gates'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_crm_lead_status_transition_gates_updatedByProfi_fkey' AND conrelid = to_regclass('public.backoffice_crm_lead_status_transition_gates')) THEN
    ALTER TABLE "public"."backoffice_crm_lead_status_transition_gates" RENAME CONSTRAINT "backoffice_crm_lead_status_transition_gates_updatedByProfileId_" TO "backoffice_crm_lead_status_transition_gates_updatedByProfi_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_crm_lead_status_transition_field_rules_updatedByProf' AND conrelid = to_regclass('public.backoffice_crm_lead_status_transition_field_rules'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_crm_lead_status_transition_field_rules_updatedB_fkey' AND conrelid = to_regclass('public.backoffice_crm_lead_status_transition_field_rules')) THEN
    ALTER TABLE "public"."backoffice_crm_lead_status_transition_field_rules" RENAME CONSTRAINT "backoffice_crm_lead_status_transition_field_rules_updatedByProf" TO "backoffice_crm_lead_status_transition_field_rules_updatedB_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_lists_managedByBackofficeUserId_f' AND conrelid = to_regclass('public.corretor_studio_email_contact_lists'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_lists_managedByBackofficeUse_fkey' AND conrelid = to_regclass('public.corretor_studio_email_contact_lists')) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_lists" RENAME CONSTRAINT "corretor_studio_email_contact_lists_managedByBackofficeUserId_f" TO "corretor_studio_email_contact_lists_managedByBackofficeUse_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_import_jobs_managedByBackofficeUserId_fke' AND conrelid = to_regclass('public.corretor_studio_email_import_jobs'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_import_jobs_managedByBackofficeUserI_fkey' AND conrelid = to_regclass('public.corretor_studio_email_import_jobs')) THEN
    ALTER TABLE "public"."corretor_studio_email_import_jobs" RENAME CONSTRAINT "corretor_studio_email_import_jobs_managedByBackofficeUserId_fke" TO "corretor_studio_email_import_jobs_managedByBackofficeUserI_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_tags_team_name_key' AND conrelid = to_regclass('public.corretor_studio_lead_tags'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_tags_teamId_name_key' AND conrelid = to_regclass('public.corretor_studio_lead_tags')) THEN
    ALTER TABLE "public"."corretor_studio_lead_tags" RENAME CONSTRAINT "corretor_studio_lead_tags_team_name_key" TO "corretor_studio_lead_tags_teamId_name_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_tag_assignments_lead_tag_key' AND conrelid = to_regclass('public.corretor_studio_lead_tag_assignments'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_tag_assignments_leadId_tagId_key' AND conrelid = to_regclass('public.corretor_studio_lead_tag_assignments')) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" RENAME CONSTRAINT "corretor_studio_lead_tag_assignments_lead_tag_key" TO "corretor_studio_lead_tag_assignments_leadId_tagId_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_document_requests_token_key' AND conrelid = to_regclass('public.corretor_studio_lead_document_requests'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_lead_document_requests_publicToken_key' AND conrelid = to_regclass('public.corretor_studio_lead_document_requests')) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" RENAME CONSTRAINT "corretor_studio_lead_document_requests_token_key" TO "corretor_studio_lead_document_requests_publicToken_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailContactId_' AND conrelid = to_regclass('public.corretor_studio_email_contact_radar_sync_outbox'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailConta_fkey' AND conrelid = to_regclass('public.corretor_studio_email_contact_radar_sync_outbox')) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_radar_sync_outbox" RENAME CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_emailContactId_" TO "corretor_studio_email_contact_radar_sync_outbox_emailConta_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailImportJobI' AND conrelid = to_regclass('public.corretor_studio_email_contact_radar_sync_outbox'))
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_email_contact_radar_sync_outbox_emailImpor_fkey' AND conrelid = to_regclass('public.corretor_studio_email_contact_radar_sync_outbox')) THEN
    ALTER TABLE "public"."corretor_studio_email_contact_radar_sync_outbox" RENAME CONSTRAINT "corretor_studio_email_contact_radar_sync_outbox_emailImportJobI" TO "corretor_studio_email_contact_radar_sync_outbox_emailImpor_fkey";
  END IF;
END $$;

-- 2. Índices sem constraint de suporte ---------------------------------------

DO $$
BEGIN
  IF to_regclass('public."whatsapp_sync_jobs_team_config_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_sync_jobs_teamId_configId_status_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_sync_jobs_team_config_idx" RENAME TO "whatsapp_sync_jobs_teamId_configId_status_idx";
  END IF;
  IF to_regclass('public."profile_user_type_assignments_access_expires_at_idx"') IS NOT NULL
     AND to_regclass('public."profile_user_type_assignments_accessExpiresAt_idx"') IS NULL THEN
    ALTER INDEX "public"."profile_user_type_assignments_access_expires_at_idx" RENAME TO "profile_user_type_assignments_accessExpiresAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_transfers_from_team_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_transfers_fromTeamId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_transfers_from_team_created_idx" RENAME TO "corretor_studio_lead_transfers_fromTeamId_createdAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_public_form_queue_event_failures_idempotencyKey"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_queue_event_failures_idempotenc_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_public_form_queue_event_failures_idempotencyKey" RENAME TO "corretor_studio_public_form_queue_event_failures_idempotenc_key";
  END IF;
  IF to_regclass('public."whatsapp_messages_conversationId_providerTimestamp_createdAt_id"') IS NOT NULL
     AND to_regclass('public."whatsapp_messages_conversationId_providerTimestamp_createdA_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_messages_conversationId_providerTimestamp_createdAt_id" RENAME TO "whatsapp_messages_conversationId_providerTimestamp_createdA_idx";
  END IF;
  IF to_regclass('public."public_form_metric_events_session_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_metric_events_visitorSessionId__idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_metric_events_session_created_idx" RENAME TO "corretor_studio_public_form_metric_events_visitorSessionId__idx";
  END IF;
  IF to_regclass('public."whatsapp_sync_jobs_claim_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_sync_jobs_status_leaseExpiresAt_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_sync_jobs_claim_idx" RENAME TO "whatsapp_sync_jobs_status_leaseExpiresAt_createdAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_events_idempotent_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_events_teamId_sourceType_sourceId_eve_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_events_idempotent_key" RENAME TO "corretor_studio_radar_events_teamId_sourceType_sourceId_eve_key";
  END IF;
  IF to_regclass('public."corretor_studio_resend_webhook_processing_failures_status_nextA"') IS NOT NULL
     AND to_regclass('public."corretor_studio_resend_webhook_processing_failures_status_n_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_resend_webhook_processing_failures_status_nextA" RENAME TO "corretor_studio_resend_webhook_processing_failures_status_n_idx";
  END IF;
  IF to_regclass('public."whatsapp_audit_events_team_created_at_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_audit_events_teamId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_audit_events_team_created_at_idx" RENAME TO "whatsapp_audit_events_teamId_createdAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_tag_assignments_tag_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_tag_assignments_tagId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_tag_assignments_tag_idx" RENAME TO "corretor_studio_lead_tag_assignments_tagId_idx";
  END IF;
  IF to_regclass('public."public_form_rules_target_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_rules_targetQuestionId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_rules_target_idx" RENAME TO "corretor_studio_public_form_rules_targetQuestionId_idx";
  END IF;
  IF to_regclass('public."backoffice_lead_status_transition_field_rules_target_status_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_lead_status_transition_field_rules_targetStatus_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_lead_status_transition_field_rules_target_status_idx" RENAME TO "backoffice_lead_status_transition_field_rules_targetStatus_idx";
  END IF;
  IF to_regclass('public."whatsapp_outbound_commands_status_updated_at_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_outbound_commands_status_updatedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_outbound_commands_status_updated_at_idx" RENAME TO "whatsapp_outbound_commands_status_updatedAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_events_team_type_occurred_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_events_teamId_eventType_occurredAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_events_team_type_occurred_idx" RENAME TO "corretor_studio_radar_events_teamId_eventType_occurredAt_idx";
  END IF;
  IF to_regclass('public."backoffice_crm_lead_status_transition_gates_enabled_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_crm_lead_status_transition_gates_isEnabled_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_crm_lead_status_transition_gates_enabled_idx" RENAME TO "backoffice_crm_lead_status_transition_gates_isEnabled_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_contact_lists_managedByBackofficeUserId_i"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_contact_lists_managedByBackofficeUser_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_contact_lists_managedByBackofficeUserId_i" RENAME TO "corretor_studio_email_contact_lists_managedByBackofficeUser_idx";
  END IF;
  IF to_regclass('public."backoffice_crm_lead_status_transition_field_rules_target_status"') IS NOT NULL
     AND to_regclass('public."backoffice_crm_lead_status_transition_field_rules_targetSta_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_crm_lead_status_transition_field_rules_target_status" RENAME TO "backoffice_crm_lead_status_transition_field_rules_targetSta_idx";
  END IF;
  IF to_regclass('public."corretor_studio_public_form_submissions_publicationId_visitorSe"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_submissions_publicationId_visit_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_public_form_submissions_publicationId_visitorSe" RENAME TO "corretor_studio_public_form_submissions_publicationId_visit_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_campaign_dispatches_campaignId_dispatchNu"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_campaign_dispatches_campaignId_dispat_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_campaign_dispatches_campaignId_dispatchNu" RENAME TO "corretor_studio_email_campaign_dispatches_campaignId_dispat_key";
  END IF;
  IF to_regclass('public."team_whatsapp_contacts_sync_idx"') IS NOT NULL
     AND to_regclass('public."team_whatsapp_contacts_teamId_syncState_lastSyncedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."team_whatsapp_contacts_sync_idx" RENAME TO "team_whatsapp_contacts_teamId_syncState_lastSyncedAt_idx";
  END IF;
  IF to_regclass('public."whatsapp_messages_deleted_at_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_messages_deletedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_messages_deleted_at_idx" RENAME TO "whatsapp_messages_deletedAt_idx";
  END IF;
  IF to_regclass('public."backoffice_lead_status_transition_gates_sort_order_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_lead_status_transition_gates_sortOrder_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_lead_status_transition_gates_sort_order_idx" RENAME TO "backoffice_lead_status_transition_gates_sortOrder_idx";
  END IF;
  IF to_regclass('public."whatsapp_contact_identities_team_contact_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_contact_identities_teamId_contactId_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_contact_identities_team_contact_idx" RENAME TO "whatsapp_contact_identities_teamId_contactId_idx";
  END IF;
  IF to_regclass('public."public_form_metric_events_form_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_metric_events_formId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_metric_events_form_created_idx" RENAME TO "corretor_studio_public_form_metric_events_formId_createdAt_idx";
  END IF;
  IF to_regclass('public."team_whatsapp_contacts_team_search_text_idx"') IS NOT NULL
     AND to_regclass('public."team_whatsapp_contacts_teamId_searchText_idx"') IS NULL THEN
    ALTER INDEX "public"."team_whatsapp_contacts_team_search_text_idx" RENAME TO "team_whatsapp_contacts_teamId_searchText_idx";
  END IF;
  IF to_regclass('public."backoffice_lead_status_transition_field_rules_target_field_key"') IS NOT NULL
     AND to_regclass('public."backoffice_lead_status_transition_field_rules_targetStatus__key"') IS NULL THEN
    ALTER INDEX "public"."backoffice_lead_status_transition_field_rules_target_field_key" RENAME TO "backoffice_lead_status_transition_field_rules_targetStatus__key";
  END IF;
  IF to_regclass('public."public_form_submissions_publication_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_submissions_publicationId_creat_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_submissions_publication_created_idx" RENAME TO "corretor_studio_public_form_submissions_publicationId_creat_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_emailContactId_"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_emailContac_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_contact_radar_sync_outbox_emailContactId_" RENAME TO "corretor_studio_email_contact_radar_sync_outbox_emailContac_key";
  END IF;
  IF to_regclass('public."corretor_studio_radar_source_links_profile_source_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_source_links_profileId_sourceType_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_source_links_profile_source_idx" RENAME TO "corretor_studio_radar_source_links_profileId_sourceType_idx";
  END IF;
  IF to_regclass('public."corretor_studio_team_automation_rules_teamId_triggerType_isEnab"') IS NOT NULL
     AND to_regclass('public."corretor_studio_team_automation_rules_teamId_triggerType_is_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_team_automation_rules_teamId_triggerType_isEnab" RENAME TO "corretor_studio_team_automation_rules_teamId_triggerType_is_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_requests_team_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_requests_teamId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_requests_team_idx" RENAME TO "corretor_studio_lead_document_requests_teamId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_activities_lead_id_type_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_activities_leadId_type_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_activities_lead_id_type_idx" RENAME TO "corretor_studio_lead_activities_leadId_type_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_templates_version_group_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_templates_teamId_versionGroupId_versi_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_templates_version_group_idx" RENAME TO "corretor_studio_email_templates_teamId_versionGroupId_versi_idx";
  END IF;
  IF to_regclass('public."whatsapp_conversations_deleted_at_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_conversations_deletedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_conversations_deleted_at_idx" RENAME TO "whatsapp_conversations_deletedAt_idx";
  END IF;
  IF to_regclass('public."profile_user_type_assignments_profile_id_key"') IS NOT NULL
     AND to_regclass('public."profile_user_type_assignments_profileId_key"') IS NULL THEN
    ALTER INDEX "public"."profile_user_type_assignments_profile_id_key" RENAME TO "profile_user_type_assignments_profileId_key";
  END IF;
  IF to_regclass('public."corretor_studio_email_templates_version_group_number_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_templates_versionGroupId_versionNumbe_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_templates_version_group_number_key" RENAME TO "corretor_studio_email_templates_versionGroupId_versionNumbe_key";
  END IF;
  IF to_regclass('public."corretor_studio_radar_channel_consents_profile_channel_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_channel_consents_profileId_channel_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_channel_consents_profile_channel_key" RENAME TO "corretor_studio_radar_channel_consents_profileId_channel_key";
  END IF;
  IF to_regclass('public."corretor_studio_radar_profiles_team_phone_name_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_profiles_teamId_normalizedPhone_norma_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_profiles_team_phone_name_key" RENAME TO "corretor_studio_radar_profiles_teamId_normalizedPhone_norma_key";
  END IF;
  IF to_regclass('public."backoffice_contract_versions_sharetokenhash_key"') IS NOT NULL
     AND to_regclass('public."backoffice_contract_versions_shareTokenHash_key"') IS NULL THEN
    ALTER INDEX "public"."backoffice_contract_versions_sharetokenhash_key" RENAME TO "backoffice_contract_versions_shareTokenHash_key";
  END IF;
  IF to_regclass('public."backoffice_lead_status_transition_gates_enabled_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_lead_status_transition_gates_isEnabled_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_lead_status_transition_gates_enabled_idx" RENAME TO "backoffice_lead_status_transition_gates_isEnabled_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_events_profile_occurred_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_events_profileId_occurredAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_events_profile_occurred_idx" RENAME TO "corretor_studio_radar_events_profileId_occurredAt_idx";
  END IF;
  IF to_regclass('public."public_form_rules_source_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_rules_sourceQuestionId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_rules_source_idx" RENAME TO "corretor_studio_public_form_rules_sourceQuestionId_idx";
  END IF;
  IF to_regclass('public."meeting_follow_up_digest_logs_recipient_team_date_idx"') IS NOT NULL
     AND to_regclass('public."meeting_follow_up_digest_logs_recipientProfileId_teamId_dig_idx"') IS NULL THEN
    ALTER INDEX "public"."meeting_follow_up_digest_logs_recipient_team_date_idx" RENAME TO "meeting_follow_up_digest_logs_recipientProfileId_teamId_dig_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_custom_field_values_leadId_definitionId_ke"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_custom_field_values_leadId_definitionI_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_custom_field_values_leadId_definitionId_ke" RENAME TO "corretor_studio_lead_custom_field_values_leadId_definitionI_key";
  END IF;
  IF to_regclass('public."public_form_answers_question_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_answers_questionId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_answers_question_idx" RENAME TO "corretor_studio_public_form_answers_questionId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_queue_processing_failures_status_nextAttemptAt_"') IS NOT NULL
     AND to_regclass('public."corretor_studio_queue_processing_failures_status_nextAttemp_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_queue_processing_failures_status_nextAttemptAt_" RENAME TO "corretor_studio_queue_processing_failures_status_nextAttemp_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_source_links_team_source_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_source_links_teamId_sourceType_source_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_source_links_team_source_key" RENAME TO "corretor_studio_radar_source_links_teamId_sourceType_source_key";
  END IF;
  IF to_regclass('public."backoffice_deletion_audit_logs_entity_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_deletion_audit_logs_entityType_entityId_createdA_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_deletion_audit_logs_entity_idx" RENAME TO "backoffice_deletion_audit_logs_entityType_entityId_createdA_idx";
  END IF;
  IF to_regclass('public."public_form_submissions_lead_submitted_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_submissions_leadId_submittedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_submissions_lead_submitted_idx" RENAME TO "corretor_studio_public_form_submissions_leadId_submittedAt_idx";
  END IF;
  IF to_regclass('public."public_form_questions_form_position_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_questions_formId_position_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_questions_form_position_idx" RENAME TO "corretor_studio_public_form_questions_formId_position_idx";
  END IF;
  IF to_regclass('public."whatsapp_contact_identities_config_kind_seen_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_contact_identities_configId_identityType_lastSeenA_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_contact_identities_config_kind_seen_idx" RENAME TO "whatsapp_contact_identities_configId_identityType_lastSeenA_idx";
  END IF;
  IF to_regclass('public."backoffice_form_engagement_score_rules_minPercent_maxPercent_ke"') IS NOT NULL
     AND to_regclass('public."backoffice_form_engagement_score_rules_minPercent_maxPercen_key"') IS NULL THEN
    ALTER INDEX "public"."backoffice_form_engagement_score_rules_minPercent_maxPercent_ke" RENAME TO "backoffice_form_engagement_score_rules_minPercent_maxPercen_key";
  END IF;
  IF to_regclass('public."google_oauth_connections_owner_profile_id_idx"') IS NOT NULL
     AND to_regclass('public."google_oauth_connections_ownerProfileId_idx"') IS NULL THEN
    ALTER INDEX "public"."google_oauth_connections_owner_profile_id_idx" RENAME TO "google_oauth_connections_ownerProfileId_idx";
  END IF;
  IF to_regclass('public."meeting_follow_up_digest_logs_sent_at_idx"') IS NOT NULL
     AND to_regclass('public."meeting_follow_up_digest_logs_sentAt_idx"') IS NULL THEN
    ALTER INDEX "public"."meeting_follow_up_digest_logs_sent_at_idx" RENAME TO "meeting_follow_up_digest_logs_sentAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_profiles_team_document_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_profiles_teamId_normalizedPrimaryDocu_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_profiles_team_document_idx" RENAME TO "corretor_studio_radar_profiles_teamId_normalizedPrimaryDocu_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_campaign_dispatches_campaignId_dispatched"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_campaign_dispatches_campaignId_dispat_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_campaign_dispatches_campaignId_dispatched" RENAME TO "corretor_studio_email_campaign_dispatches_campaignId_dispat_idx";
  END IF;
  IF to_regclass('public."whatsapp_audit_events_conversation_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_audit_events_conversationId_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_audit_events_conversation_idx" RENAME TO "whatsapp_audit_events_conversationId_idx";
  END IF;
  IF to_regclass('public."whatsapp_auto_response_logs_conversationId_ruleType_createdAt_i"') IS NOT NULL
     AND to_regclass('public."whatsapp_auto_response_logs_conversationId_ruleType_created_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_auto_response_logs_conversationId_ruleType_createdAt_i" RENAME TO "whatsapp_auto_response_logs_conversationId_ruleType_created_idx";
  END IF;
  IF to_regclass('public."corretor_studio_notifications_recipientProfileId_teamId_created"') IS NOT NULL
     AND to_regclass('public."corretor_studio_notifications_recipientProfileId_teamId_cre_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_notifications_recipientProfileId_teamId_created" RENAME TO "corretor_studio_notifications_recipientProfileId_teamId_cre_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_profiles_team_email_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_profiles_teamId_normalizedPrimaryEmai_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_profiles_team_email_idx" RENAME TO "corretor_studio_radar_profiles_teamId_normalizedPrimaryEmai_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_identities_profile_type_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_identities_profileId_type_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_identities_profile_type_idx" RENAME TO "corretor_studio_radar_identities_profileId_type_idx";
  END IF;
  IF to_regclass('public."public_form_publications_history_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_publications_formId_endedAt_pub_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_publications_history_idx" RENAME TO "corretor_studio_public_form_publications_formId_endedAt_pub_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_transfers_to_team_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_transfers_toTeamId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_transfers_to_team_created_idx" RENAME TO "corretor_studio_lead_transfers_toTeamId_createdAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_public_form_queue_event_failures_status_nextAtt"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_queue_event_failures_status_nex_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_public_form_queue_event_failures_status_nextAtt" RENAME TO "corretor_studio_public_form_queue_event_failures_status_nex_idx";
  END IF;
  IF to_regclass('public."public_form_metric_events_publication_type_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_metric_events_publicationId_eve_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_metric_events_publication_type_created_idx" RENAME TO "corretor_studio_public_form_metric_events_publicationId_eve_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_custom_field_definitions_teamId_isActive_d"') IS NOT NULL
     AND to_regclass('public."lead_custom_field_defs_team_active_order_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_custom_field_definitions_teamId_isActive_d" RENAME TO "lead_custom_field_defs_team_active_order_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_requests_status_email_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_requests_status_lastEmailSent_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_requests_status_email_idx" RENAME TO "corretor_studio_lead_document_requests_status_lastEmailSent_idx";
  END IF;
  IF to_regclass('public."profile_user_type_assignments_user_type_id_idx"') IS NOT NULL
     AND to_regclass('public."profile_user_type_assignments_userTypeId_idx"') IS NULL THEN
    ALTER INDEX "public"."profile_user_type_assignments_user_type_id_idx" RENAME TO "profile_user_type_assignments_userTypeId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_team_automation_run_logs_ruleId_leadId_dedupeKe"') IS NOT NULL
     AND to_regclass('public."corretor_studio_team_automation_run_logs_ruleId_leadId_dedu_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_team_automation_run_logs_ruleId_leadId_dedupeKe" RENAME TO "corretor_studio_team_automation_run_logs_ruleId_leadId_dedu_key";
  END IF;
  IF to_regclass('public."google_oauth_connections_google_email_idx"') IS NOT NULL
     AND to_regclass('public."google_oauth_connections_googleEmail_idx"') IS NULL THEN
    ALTER INDEX "public"."google_oauth_connections_google_email_idx" RENAME TO "google_oauth_connections_googleEmail_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_channel_consents_team_channel_status_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_channel_consents_teamId_channel_statu_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_channel_consents_team_channel_status_idx" RENAME TO "corretor_studio_radar_channel_consents_teamId_channel_statu_idx";
  END IF;
  IF to_regclass('public."public_form_answers_submission_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_answers_submissionId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_answers_submission_idx" RENAME TO "corretor_studio_public_form_answers_submissionId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_tags_team_sort_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_tags_teamId_sortOrder_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_tags_team_sort_idx" RENAME TO "corretor_studio_lead_tags_teamId_sortOrder_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_request_items_request_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_request_items_requestId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_request_items_request_idx" RENAME TO "corretor_studio_lead_document_request_items_requestId_idx";
  END IF;
  -- `corretor_studio_radar_profiles_team_last_seen_idx` NÃO entra aqui de
  -- propósito: ele é `("teamId", "lastSeenAt" DESC NULLS LAST)` e o Prisma gera
  -- `DESC` (NULLS FIRST) para `@@index([teamId, lastSeenAt(sort: Desc)])`.
  -- Renomear daria a ele o nome canônico com a semântica errada. A troca é
  -- feita em 20260824011945, que dropa o legado e garante o do Prisma.
  IF to_regclass('public."corretor_studio_email_campaign_dispatches_teamId_dispatchedAt_i"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_campaign_dispatches_teamId_dispatched_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_campaign_dispatches_teamId_dispatchedAt_i" RENAME TO "corretor_studio_email_campaign_dispatches_teamId_dispatched_idx";
  END IF;
  IF to_regclass('public."corretor_studio_team_transfer_routes_target_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_team_transfer_routes_targetTeamId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_team_transfer_routes_target_idx" RENAME TO "corretor_studio_team_transfer_routes_targetTeamId_idx";
  END IF;
  IF to_regclass('public."public_form_options_question_position_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_options_questionId_position_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_options_question_position_idx" RENAME TO "corretor_studio_public_form_options_questionId_position_idx";
  END IF;
  IF to_regclass('public."public_forms_assigned_sdr_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_forms_assignedSdrId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_forms_assigned_sdr_idx" RENAME TO "corretor_studio_public_forms_assignedSdrId_idx";
  END IF;
  IF to_regclass('public."backoffice_crm_lead_status_transition_field_rules_target_field_"') IS NOT NULL
     AND to_regclass('public."backoffice_crm_lead_status_transition_field_rules_targetSta_key"') IS NULL THEN
    ALTER INDEX "public"."backoffice_crm_lead_status_transition_field_rules_target_field_" RENAME TO "backoffice_crm_lead_status_transition_field_rules_targetSta_key";
  END IF;
  IF to_regclass('public."public_form_submissions_form_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_submissions_formId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_submissions_form_created_idx" RENAME TO "corretor_studio_public_form_submissions_formId_createdAt_idx";
  END IF;
  IF to_regclass('public."backoffice_crm_lead_status_transition_gates_sort_order_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_crm_lead_status_transition_gates_sortOrder_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_crm_lead_status_transition_gates_sort_order_idx" RENAME TO "backoffice_crm_lead_status_transition_gates_sortOrder_idx";
  END IF;
  IF to_regclass('public."public_forms_team_approval_updated_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_forms_teamId_approvalStatus_updatedA_idx"') IS NULL THEN
    ALTER INDEX "public"."public_forms_team_approval_updated_idx" RENAME TO "corretor_studio_public_forms_teamId_approvalStatus_updatedA_idx";
  END IF;
  IF to_regclass('public."backoffice_products_feature_slugs_gin_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_products_featureSlugs_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_products_feature_slugs_gin_idx" RENAME TO "backoffice_products_featureSlugs_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_transfers_lead_created_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_transfers_leadId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_transfers_lead_created_idx" RENAME TO "corretor_studio_lead_transfers_leadId_createdAt_idx";
  END IF;
  IF to_regclass('public."public_form_score_bands_range_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_score_bands_formId_minScore_max_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_score_bands_range_idx" RENAME TO "corretor_studio_public_form_score_bands_formId_minScore_max_idx";
  END IF;
  IF to_regclass('public."public_forms_team_status_updated_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_forms_teamId_status_updatedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."public_forms_team_status_updated_idx" RENAME TO "corretor_studio_public_forms_teamId_status_updatedAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_profiles_google_connection_id_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_profiles_googleConnectionId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_profiles_google_connection_id_idx" RENAME TO "corretor_studio_profiles_googleConnectionId_idx";
  END IF;
  IF to_regclass('public."public_form_rules_form_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_rules_formId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_rules_form_idx" RENAME TO "corretor_studio_public_form_rules_formId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_status_nextAtte"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_status_next_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_contact_radar_sync_outbox_status_nextAtte" RENAME TO "corretor_studio_email_contact_radar_sync_outbox_status_next_idx";
  END IF;
  IF to_regclass('public."corretor_studio_radar_identities_team_type_value_key"') IS NOT NULL
     AND to_regclass('public."corretor_studio_radar_identities_teamId_type_normalizedValu_key"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_radar_identities_team_type_value_key" RENAME TO "corretor_studio_radar_identities_teamId_type_normalizedValu_key";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_requests_expires_at_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_requests_expiresAt_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_requests_expires_at_idx" RENAME TO "corretor_studio_lead_document_requests_expiresAt_idx";
  END IF;
  IF to_regclass('public."backoffice_bot_host_ops_jobs_requestedBy_createdAt_idx"') IS NOT NULL
     AND to_regclass('public."backoffice_bot_host_ops_jobs_requestedByProfileId_createdAt_idx"') IS NULL THEN
    ALTER INDEX "public"."backoffice_bot_host_ops_jobs_requestedBy_createdAt_idx" RENAME TO "backoffice_bot_host_ops_jobs_requestedByProfileId_createdAt_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_requests_lead_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_requests_leadId_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_requests_lead_idx" RENAME TO "corretor_studio_lead_document_requests_leadId_idx";
  END IF;
  IF to_regclass('public."whatsapp_messages_media_ingest_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_messages_mediaStatus_mediaAttemptCount_updatedAt_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_messages_media_ingest_idx" RENAME TO "whatsapp_messages_mediaStatus_mediaAttemptCount_updatedAt_idx";
  END IF;
  IF to_regclass('public."public_form_eligible_closers_profile_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_public_form_eligible_closers_profileId_idx"') IS NULL THEN
    ALTER INDEX "public"."public_form_eligible_closers_profile_idx" RENAME TO "corretor_studio_public_form_eligible_closers_profileId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_lead_document_requests_token_idx"') IS NOT NULL
     AND to_regclass('public."corretor_studio_lead_document_requests_publicToken_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_lead_document_requests_token_idx" RENAME TO "corretor_studio_lead_document_requests_publicToken_idx";
  END IF;
  IF to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_emailImportJobI"') IS NOT NULL
     AND to_regclass('public."corretor_studio_email_contact_radar_sync_outbox_emailImport_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_email_contact_radar_sync_outbox_emailImportJobI" RENAME TO "corretor_studio_email_contact_radar_sync_outbox_emailImport_idx";
  END IF;
  IF to_regclass('public."whatsapp_conversations_team_contact_idx"') IS NOT NULL
     AND to_regclass('public."whatsapp_conversations_teamId_contactId_idx"') IS NULL THEN
    ALTER INDEX "public"."whatsapp_conversations_team_contact_idx" RENAME TO "whatsapp_conversations_teamId_contactId_idx";
  END IF;
  IF to_regclass('public."corretor_studio_team_radar_field_definitions_teamId_isActive_id"') IS NOT NULL
     AND to_regclass('public."corretor_studio_team_radar_field_definitions_teamId_isActiv_idx"') IS NULL THEN
    ALTER INDEX "public"."corretor_studio_team_radar_field_definitions_teamId_isActive_id" RENAME TO "corretor_studio_team_radar_field_definitions_teamId_isActiv_idx";
  END IF;
END $$;

