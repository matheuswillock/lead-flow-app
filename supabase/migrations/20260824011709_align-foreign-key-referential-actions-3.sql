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

-- LOCK e DDL no MESMO bloco DO, de proposito.
--
-- O `supabase db push` NAO roda o arquivo dentro de um bloco de transacao —
-- confirmado no log do run 32752152486: `WARNING (25P01): SET LOCAL can only be
-- used in transaction blocks`. Duas consequencias que invalidaram as tentativas
-- anteriores:
--
--   1. Um `SET LOCAL lock_timeout` no nivel do arquivo nao tem efeito nenhum. O
--      timeout ficava no default (0 = esperar para sempre).
--   2. Cada statement vira sua propria transacao. Um bloco DO so para travar
--      as tabelas LIBERA tudo ao terminar, antes de o DDL comecar.
--
-- Por isso o lock e o DDL vivem num unico bloco: um bloco DO e um statement, e
-- um statement e uma transacao implicita. Os locks ficam retidos ate o fim.
--
-- Trava tudo de uma vez, em ordem de dependencia de FK, ANTES de qualquer DDL.
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
-- A ordem e a TOPOLOGICA do grafo de FK — pai antes de filha — e MUST ser a
-- mesma em todos os lotes desta serie. Ordem alfabetica NAO serve: ela alinha
-- os lotes entre si mas nao com a aplicacao.
--
-- Ordem sozinha tambem nao basta, e isso foi medido: reproduzi o deadlock
-- localmente com uma sessao concorrente lendo `corretor_studio_teams` e depois
-- `corretor_studio_profiles` — direcao filha->pai, que qualquer "carrega o time
-- e depois o master" faz. Nao da para ordenar de forma a concordar com todos os
-- caminhos da aplicacao ao mesmo tempo.
--
-- Por isso o `lock_timeout` de 500ms, abaixo do `deadlock_timeout` (1s por
-- padrao): sob contencao a migration aborta com 55P03 ANTES de o detector de
-- deadlock escolher uma vitima. Isso importa porque a vitima e arbitraria — na
-- reproducao local quem morreu foi a sessao da aplicacao, nao a migration. Com
-- o timeout curto quem cede e sempre a migration, e o trafego nao e afetado.
-- Abortar e seguro: cada bloco abaixo e idempotente, basta re-rodar o pipeline.
-- O LOCK e condicional pelo mesmo motivo que os guards abaixo usam
-- `to_regclass`: nem toda tabela existe em toda base (replay local, ambiente
-- parcial). Um `LOCK TABLE` cru aborta com "relation does not exist" e quebra
-- o `db:migrate:reset:local`.
-- RETRY (adicionado depois do run 32752152486)
--
-- O pre-lock em ordem topologica NAO resolveu: o run 32752152486, ja com ele,
-- falhou com o MESMO deadlock nas MESMAS relacoes (154462 / 154398) do run
-- anterior. Ordenar locks so previne deadlock se TODAS as partes seguirem a
-- ordem — e a contraparte aqui pede `AccessShareLock`, ou seja, e um SELECT de
-- producao. Nao ha como impor ordem de lock ao planner do app.
--
-- O `lock_timeout` de 500ms tambem nao salva: ele limita quanto ESTE processo
-- espera, mas nao impede o processo do app de detectar o ciclo primeiro (seu
-- `deadlock_timeout` de 1s) e escolher esta transacao como vitima. Por isso o
-- erro observado e 40P01 (deadlock) e nao 55P03 (timeout) — a corrida entre os
-- 500ms e o detector do outro lado nao e vencida de forma confiavel.
--
-- Deadlock e TRANSITORIO por definicao: o Postgres mata um lado e o outro
-- segue. Reexecutar e o conserto que ataca a natureza real do problema.
--
-- O bloco EXCEPTION cria um savepoint; ao abortar, os locks adquiridos dentro
-- dele sao liberados junto, entao o sleep do backoff NAO segura a fila.
-- Backoff com jitter de proposito: retry em intervalo fixo tende a recolidir
-- com o mesmo padrao de trafego.
DO $$
DECLARE
  target text;
  attempt int := 0;
  max_attempts constant int := 5;
BEGIN
  LOOP
    attempt := attempt + 1;
    BEGIN
  -- Indentacao do corpo mantida de proposito: reindentar ~140 linhas so para
  -- acomodar o wrapper esconderia a mudanca real num diff gigante.

  -- `true` = local a transacao. Um `SET LOCAL` no nivel do arquivo nao funciona
  -- aqui, porque o runner nao abre bloco de transacao; dentro do bloco DO,
  -- funciona. 500ms fica abaixo do deadlock_timeout de propósito.
  PERFORM set_config('lock_timeout', '500ms', true);

  -- Ordem topologica do grafo de FK: PAI antes de FILHA. Nao alfabetica.
  -- A aplicacao escreve pai-antes-de-filha (atualiza o time, depois as linhas
  -- que apontam para ele; cascata de delete tambem desce nessa direcao). Travar
  -- em ordem alfabetica inverteria isso em varios pares e o deadlock voltaria.
  FOREACH target IN ARRAY ARRAY[
    'public.corretor_studio_profiles',
    'public.corretor_studio_subscription_change_logs',
    'public.corretor_studio_teams',
    'public.corretor_studio_email_campaigns',
    'public.corretor_studio_radar_profiles',
    'public.corretor_studio_radar_identities',
    'public.corretor_studio_radar_segments',
    'public.corretor_studio_radar_source_links',
    'public.corretor_studio_team_email_campaign_limit_grants',
    'public.corretor_studio_team_radar_pixel_configs',
    'public.corretor_studio_team_radar_pixel_hit_logs'
  ] LOOP
    IF to_regclass(target) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
    END IF;
  END LOOP;

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

      EXIT;
    EXCEPTION
      -- 40P01 deadlock_detected e 55P03 lock_not_available (o proprio
      -- lock_timeout). Os dois sao contencao passageira, nao erro de schema:
      -- reexecutar e correto. Qualquer outra excecao sobe sem retry — se a FK
      -- ou a tabela estiverem erradas, insistir so mascara o defeito.
      WHEN deadlock_detected OR lock_not_available THEN
        IF attempt >= max_attempts THEN
          RAISE NOTICE 'FK align: % tentativas esgotadas', max_attempts;
          RAISE;
        END IF;
        RAISE NOTICE 'FK align: contencao na tentativa %/% (%), repetindo',
          attempt, max_attempts, SQLSTATE;
        PERFORM pg_sleep(attempt * 0.5 + random() * 0.5);
    END;
  END LOOP;
END $$;
