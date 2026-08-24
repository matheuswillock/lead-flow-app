-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 4/6.
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
-- 15 constraint(s) em 8 tabela(s):
--   corretor_studio_team_transfer_routes
--   email_team_senders
--   google_oauth_connections
--   team_whatsapp_configs
--   team_whatsapp_contacts
--   whatsapp_audit_events
--   whatsapp_auto_response_logs
--   whatsapp_auto_response_rules
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

SET LOCAL lock_timeout = '5s';

-- Trava tudo de uma vez, em ordem alfabetica, ANTES de qualquer DDL.
-- Mesma correcao do lote 3, que falhou em producao com deadlock (SQLSTATE
-- 40P01, run 32745879206): `lock_timeout` limita espera, nao evita deadlock —
-- o `deadlock_timeout` (1s) aborta antes. A aquisicao incremental de lock
-- dentro do bloco DO era a causa. A ordem alfabetica MUST ser a mesma em todos
-- os lotes desta serie, para que dois lotes nunca peguem as mesmas tabelas em
-- ordens opostas.
-- O LOCK e condicional pelo mesmo motivo que os guards abaixo usam
-- `to_regclass`: nem toda tabela existe em toda base (replay local, ambiente
-- parcial). Um `LOCK TABLE` cru aborta com "relation does not exist" e quebra
-- o `db:migrate:reset:local`.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.corretor_studio_profiles',
    'public.corretor_studio_team_transfer_routes',
    'public.corretor_studio_teams',
    'public.email_team_senders',
    'public.google_oauth_connections',
    'public.team_whatsapp_configs',
    'public.team_whatsapp_contacts',
    'public.whatsapp_audit_events',
    'public.whatsapp_auto_response_logs',
    'public.whatsapp_auto_response_rules',
    'public.whatsapp_conversations'
  ] LOOP
    IF to_regclass(target) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_sourceTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sourceTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_targetTeamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("targetTeamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_transfer_routes_createdBy_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_transfer_routes"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdBy") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" DROP CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey";
    ALTER TABLE "public"."corretor_studio_team_transfer_routes" ADD CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_team_senders_teamId_fkey'
      AND conrelid = to_regclass('public."email_team_senders"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."email_team_senders" DROP CONSTRAINT "email_team_senders_teamId_fkey";
    ALTER TABLE "public"."email_team_senders" ADD CONSTRAINT "email_team_senders_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_oauth_connections_ownerProfileId_fkey'
      AND conrelid = to_regclass('public."google_oauth_connections"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("ownerProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."google_oauth_connections" DROP CONSTRAINT "google_oauth_connections_ownerProfileId_fkey";
    ALTER TABLE "public"."google_oauth_connections" ADD CONSTRAINT "google_oauth_connections_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_teamId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_createdByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id)'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_configs_updatedByProfileId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id)'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_configs" DROP CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey";
    ALTER TABLE "public"."team_whatsapp_configs" ADD CONSTRAINT "team_whatsapp_configs_updatedByProfileId_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_whatsapp_contacts_teamId_fkey'
      AND conrelid = to_regclass('public."team_whatsapp_contacts"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."team_whatsapp_contacts" DROP CONSTRAINT "team_whatsapp_contacts_teamId_fkey";
    ALTER TABLE "public"."team_whatsapp_contacts" ADD CONSTRAINT "team_whatsapp_contacts_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_audit_events_actorProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_audit_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_audit_events" DROP CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey";
    ALTER TABLE "public"."whatsapp_audit_events" ADD CONSTRAINT "whatsapp_audit_events_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" DROP CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_logs" ADD CONSTRAINT "whatsapp_auto_response_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_ruleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("ruleId") REFERENCES whatsapp_auto_response_rules(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs" DROP CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_logs" ADD CONSTRAINT "whatsapp_auto_response_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES whatsapp_auto_response_rules(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_rules_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_auto_response_rules"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_rules" DROP CONSTRAINT "whatsapp_auto_response_rules_configId_fkey";
    ALTER TABLE "public"."whatsapp_auto_response_rules" ADD CONSTRAINT "whatsapp_auto_response_rules_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
