-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 6/6.
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
-- 9 constraint(s) em 5 tabela(s):
--   whatsapp_outbound_commands
--   whatsapp_send_rate_limit_windows
--   whatsapp_sync_jobs
--   whatsapp_usage_events
--   whatsapp_webhook_events
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" DROP CONSTRAINT "whatsapp_outbound_commands_teamId_fkey";
    ALTER TABLE "public"."whatsapp_outbound_commands" ADD CONSTRAINT "whatsapp_outbound_commands_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_outbound_commands_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_outbound_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_outbound_commands" DROP CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_outbound_commands" ADD CONSTRAINT "whatsapp_outbound_commands_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_send_rate_limit_windows_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_send_rate_limit_windows"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" DROP CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey";
    ALTER TABLE "public"."whatsapp_send_rate_limit_windows" ADD CONSTRAINT "whatsapp_send_rate_limit_windows_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" DROP CONSTRAINT "whatsapp_sync_jobs_teamId_fkey";
    ALTER TABLE "public"."whatsapp_sync_jobs" ADD CONSTRAINT "whatsapp_sync_jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_sync_jobs_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_sync_jobs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_sync_jobs" DROP CONSTRAINT "whatsapp_sync_jobs_configId_fkey";
    ALTER TABLE "public"."whatsapp_sync_jobs" ADD CONSTRAINT "whatsapp_sync_jobs_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" DROP CONSTRAINT "whatsapp_usage_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_usage_events" ADD CONSTRAINT "whatsapp_usage_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_usage_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_usage_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_usage_events" DROP CONSTRAINT "whatsapp_usage_events_configId_fkey";
    ALTER TABLE "public"."whatsapp_usage_events" ADD CONSTRAINT "whatsapp_usage_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" DROP CONSTRAINT "whatsapp_webhook_events_configId_fkey";
    ALTER TABLE "public"."whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_webhook_events_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_webhook_events"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_webhook_events" DROP CONSTRAINT "whatsapp_webhook_events_teamId_fkey";
    ALTER TABLE "public"."whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
