-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 2/6.
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
-- 16 constraint(s) em 8 tabela(s):
--   corretor_studio_lead_document_requests
--   corretor_studio_lead_tag_assignments
--   corretor_studio_lead_tags
--   corretor_studio_lead_transfers
--   corretor_studio_leads
--   corretor_studio_profiles
--   corretor_studio_radar_channel_consents
--   corretor_studio_radar_events
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" DROP CONSTRAINT "corretor_studio_lead_document_requests_lead_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_requests" ADD CONSTRAINT "corretor_studio_lead_document_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_document_requests_creator_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_document_requests"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_document_requests" DROP CONSTRAINT "corretor_studio_lead_document_requests_creator_fkey";
    ALTER TABLE "public"."corretor_studio_lead_document_requests" ADD CONSTRAINT "corretor_studio_lead_document_requests_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" DROP CONSTRAINT "corretor_studio_lead_tag_assignments_lead_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" ADD CONSTRAINT "corretor_studio_lead_tag_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tag_assignments_tag_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tag_assignments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("tagId") REFERENCES corretor_studio_lead_tags(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" DROP CONSTRAINT "corretor_studio_lead_tag_assignments_tag_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tag_assignments" ADD CONSTRAINT "corretor_studio_lead_tag_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES corretor_studio_lead_tags(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_tags_team_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_tags"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_tags" DROP CONSTRAINT "corretor_studio_lead_tags_team_fkey";
    ALTER TABLE "public"."corretor_studio_lead_tags" ADD CONSTRAINT "corretor_studio_lead_tags_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_receivedByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("receivedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey" FOREIGN KEY ("receivedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_leadId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_fromTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("fromTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_toTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("toTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_lead_transfers_transferredByProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_lead_transfers"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("transferredByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_lead_transfers" DROP CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_lead_transfers" ADD CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey" FOREIGN KEY ("transferredByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_leads_referrer_lead_fkey'
      AND conrelid = to_regclass('public."corretor_studio_leads"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("referrerLeadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_leads" DROP CONSTRAINT "corretor_studio_leads_referrer_lead_fkey";
    ALTER TABLE "public"."corretor_studio_leads" ADD CONSTRAINT "corretor_studio_leads_referrerLeadId_fkey" FOREIGN KEY ("referrerLeadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_profiles_googleConnectionId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_profiles"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_profiles" DROP CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey";
    ALTER TABLE "public"."corretor_studio_profiles" ADD CONSTRAINT "corretor_studio_profiles_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES google_oauth_connections(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" DROP CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" ADD CONSTRAINT "corretor_studio_radar_channel_consents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_channel_consents_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_channel_consents"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" DROP CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_channel_consents" ADD CONSTRAINT "corretor_studio_radar_channel_consents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" DROP CONSTRAINT "corretor_studio_radar_events_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_events" ADD CONSTRAINT "corretor_studio_radar_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_events_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_events" DROP CONSTRAINT "corretor_studio_radar_events_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_events" ADD CONSTRAINT "corretor_studio_radar_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
