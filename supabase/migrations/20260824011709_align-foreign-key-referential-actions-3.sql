-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 3/6.
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
--   corretor_studio_radar_identities
--   corretor_studio_radar_profiles
--   corretor_studio_radar_segments
--   corretor_studio_radar_source_links
--   corretor_studio_subscription_change_logs
--   corretor_studio_team_email_campaign_limit_grants
--   corretor_studio_team_radar_pixel_configs
--   corretor_studio_team_radar_pixel_hit_logs
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

SET LOCAL lock_timeout = '5s';

-- Trava tudo de uma vez, em ordem alfabetica, ANTES de qualquer DDL.
--
-- Esta migration falhou em producao com deadlock (SQLSTATE 40P01, run
-- 32745879206). O `lock_timeout` acima nao evita isso: ele limita ESPERA,
-- enquanto o deadlock e detectado pelo `deadlock_timeout` (1s por padrao) e
-- aborta antes de os 5s serem alcancados — na execucao que falhou o erro veio
-- 1,7s depois do inicio.
--
-- A causa era a aquisicao incremental: o bloco DO pegava ACCESS EXCLUSIVE numa
-- tabela filha, fazia o DDL, e so entao precisava da tabela pai
-- (`corretor_studio_teams` e `corretor_studio_profiles` aparecem em varias FKs
-- deste lote, intercaladas com as filhas). Bastava uma transacao da aplicacao
-- segurando a pai e querendo a filha para fechar o ciclo.
--
-- Travando tudo antes, a migration nao segura lock nenhum enquanto faz DDL: ou
-- adquire o conjunto inteiro, ou aborta em 5s por lock_timeout — que e
-- reaplicavel, porque cada bloco abaixo e idempotente. A ordem alfabetica e
-- deliberada e MUST ser a mesma em todos os lotes desta serie, para que dois
-- lotes nunca peguem as mesmas tabelas em ordens opostas.
-- O LOCK e condicional pelo mesmo motivo que os guards abaixo usam
-- `to_regclass`: nem toda tabela existe em toda base (replay local, ambiente
-- parcial). Um `LOCK TABLE` cru aborta com "relation does not exist" e quebra
-- o `db:migrate:reset:local`.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.corretor_studio_email_campaigns',
    'public.corretor_studio_profiles',
    'public.corretor_studio_radar_identities',
    'public.corretor_studio_radar_profiles',
    'public.corretor_studio_radar_segments',
    'public.corretor_studio_radar_source_links',
    'public.corretor_studio_subscription_change_logs',
    'public.corretor_studio_team_email_campaign_limit_grants',
    'public.corretor_studio_team_radar_pixel_configs',
    'public.corretor_studio_team_radar_pixel_hit_logs',
    'public.corretor_studio_teams'
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
    WHERE conname = 'corretor_studio_radar_identities_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" DROP CONSTRAINT "corretor_studio_radar_identities_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_identities" ADD CONSTRAINT "corretor_studio_radar_identities_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_identities_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_identities" DROP CONSTRAINT "corretor_studio_radar_identities_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_identities" ADD CONSTRAINT "corretor_studio_radar_identities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_profiles_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_profiles"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_profiles" DROP CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_profiles" ADD CONSTRAINT "corretor_studio_radar_profiles_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_parentId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("parentId") REFERENCES corretor_studio_radar_segments(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" DROP CONSTRAINT "corretor_studio_radar_segments_parentId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_segments" ADD CONSTRAINT "corretor_studio_radar_segments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES corretor_studio_radar_segments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_segments_sourceCampaignId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_segments"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sourceCampaignId") REFERENCES corretor_studio_email_campaigns(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_segments" DROP CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_segments" ADD CONSTRAINT "corretor_studio_radar_segments_sourceCampaignId_fkey" FOREIGN KEY ("sourceCampaignId") REFERENCES corretor_studio_email_campaigns(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" DROP CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_source_links" ADD CONSTRAINT "corretor_studio_radar_source_links_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_radar_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_radar_source_links_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_radar_source_links"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_radar_source_links" DROP CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_radar_source_links" ADD CONSTRAINT "corretor_studio_radar_source_links_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_profileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" DROP CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey";
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" ADD CONSTRAINT "corretor_studio_subscription_change_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_subscription_change_logs_actorProfileId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_subscription_change_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" DROP CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey";
    ALTER TABLE "public"."corretor_studio_subscription_change_logs" ADD CONSTRAINT "corretor_studio_subscription_change_logs_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_email_campaign_limit_grants_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_email_campaign_limit_grants"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" DROP CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_email_campaign_limit_grants" ADD CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_configs_updatedByPId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_configs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE RESTRICT'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByPId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByProfileI_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corretor_studio_team_radar_pixel_hit_logs_teamId_fkey'
      AND conrelid = to_regclass('public."corretor_studio_team_radar_pixel_hit_logs"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" DROP CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey";
    ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" ADD CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
