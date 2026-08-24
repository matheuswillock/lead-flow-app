-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 1/6.
--
-- As migrations históricas criaram as FKs sem cláusula ON UPDATE (= NO ACTION);
-- o Prisma emite ON UPDATE CASCADE por padrão em relação obrigatória. Na prática
-- as duas se comportam igual — as FKs apontam para PK uuid, que nunca é
-- atualizada — mas enquanto os lados discordam, TODA execução de
-- `db:migrate:from-prisma` reescreve as mesmas FKs.
-- Ver §7.5 de docs/audits/prisma-migrations-drift-2026-08-23.md.
--
-- Por que em lotes: cada ARQUIVO de migration roda numa transação (verificado
-- com `supabase migration up`), e um bloco DO é atômico. Num arquivo único, se
-- o lock de uma tabela tardia esperasse por tráfego, os ACCESS EXCLUSIVE já
-- adquiridos nas anteriores ficariam retidos durante toda a espera. Em lotes, o
-- alcance de um bloqueio fica limitado às tabelas deste arquivo.
--
-- lock_timeout aborta rápido em vez de enfileirar: o lote inteiro volta atrás e
-- pode ser reaplicado, em vez de travar leitura e escrita esperando.
--
-- Só DROP + ADD ... NOT VALID aqui (catálogo, milissegundos por tabela). O
-- VALIDATE, que faz scan, está em 20260824134254 e pega SHARE UPDATE EXCLUSIVE,
-- que não bloqueia DML. Entre as duas as FKs ficam NOT VALID, o que ainda
-- ENFORÇA em INSERT/UPDATE novos.
--
-- 13 constraint(s) em 8 tabela(s):
--   backoffice_adhesions
--   backoffice_email_dispatch_events
--   backoffice_email_dispatches
--   backoffice_feature_grant_teams
--   backoffice_radar_outbox_throughput_configs
--   backoffice_users
--   corretor_studio_email_templates
--   corretor_studio_lead_document_request_items
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_productId_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" DROP CONSTRAINT "backoffice_adhesions_productId_fkey";
    ALTER TABLE "public"."backoffice_adhesions" ADD CONSTRAINT "backoffice_adhesions_productId_fkey" FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_adhesions_discount_approved_by_fkey'
      AND conrelid = to_regclass('public."backoffice_adhesions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("discountApprovedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions" DROP CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey";
    ALTER TABLE "public"."backoffice_adhesions" ADD CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey" FOREIGN KEY ("discountApprovedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatch_events_dispatchId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatch_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("dispatchId") REFERENCES backoffice_email_dispatches(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatch_events" DROP CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey";
    ALTER TABLE "public"."backoffice_email_dispatch_events" ADD CONSTRAINT "backoffice_email_dispatch_events_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES backoffice_email_dispatches(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_email_dispatches_profileId_fkey'
      AND conrelid = to_regclass('public."backoffice_email_dispatches"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_email_dispatches" DROP CONSTRAINT "backoffice_email_dispatches_profileId_fkey";
    ALTER TABLE "public"."backoffice_email_dispatches" ADD CONSTRAINT "backoffice_email_dispatches_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_grant_id_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("grantId") REFERENCES backoffice_feature_grants(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" DROP CONSTRAINT "backoffice_feature_grant_teams_grant_id_fkey";
    ALTER TABLE "public"."backoffice_feature_grant_teams" ADD CONSTRAINT "backoffice_feature_grant_teams_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES backoffice_feature_grants(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_feature_grant_teams_team_id_fkey'
      AND conrelid = to_regclass('public."backoffice_feature_grant_teams"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."backoffice_feature_grant_teams" DROP CONSTRAINT "backoffice_feature_grant_teams_team_id_fkey";
    ALTER TABLE "public"."backoffice_feature_grant_teams" ADD CONSTRAINT "backoffice_feature_grant_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_radar_outbox_throughput_configs_updated_by_fkey'
      AND conrelid = to_regclass('public."backoffice_radar_outbox_throughput_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" DROP CONSTRAINT "backoffice_radar_outbox_throughput_configs_updated_by_fkey";
    ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" ADD CONSTRAINT "backoffice_radar_outbox_throughput_configs_updatedByProfil_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_users" DROP CONSTRAINT "backoffice_users_googleConnectionId_fkey";
    ALTER TABLE "public"."backoffice_users" ADD CONSTRAINT "backoffice_users_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_users_linkedCorretorStudioProfileId_fkey'
      AND conrelid = to_regclass('public."backoffice_users"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("linkedCorretorStudioProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."backoffice_users" DROP CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey";
    ALTER TABLE "public"."backoffice_users" ADD CONSTRAINT "backoffice_users_linkedCorretorStudioProfileId_fkey" FOREIGN KEY ("linkedCorretorStudioProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_template_approvedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("approvedBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" DROP CONSTRAINT "email_template_approvedBy_fkey";
    ALTER TABLE "public"."corretor_studio_email_templates" ADD CONSTRAINT "corretor_studio_email_templates_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_template_rejectedBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_email_templates"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("rejectedBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates" DROP CONSTRAINT "email_template_rejectedBy_fkey";
    ALTER TABLE "public"."corretor_studio_email_templates" ADD CONSTRAINT "corretor_studio_email_templates_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_request_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("requestId") REFERENCES corretor_studio_lead_document_requests(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" DROP CONSTRAINT "corretor_studio_lead_document_request_items_request_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" ADD CONSTRAINT "corretor_studio_lead_document_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES corretor_studio_lead_document_requests(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_request_items_attachment_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_request_items"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("attachmentId") REFERENCES corretor_studio_lead_attachments(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" DROP CONSTRAINT "corretor_studio_lead_document_request_items_attachment_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_request_items" ADD CONSTRAINT "corretor_studio_lead_document_request_items_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES corretor_studio_lead_attachments(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
