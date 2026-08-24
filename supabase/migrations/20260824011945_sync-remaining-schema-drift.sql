-- Últimos itens de estrutura que existiam só de um lado da fronteira
-- schema.prisma <-> supabase/migrations. Ver §7.5 de
-- docs/audits/prisma-migrations-drift-2026-08-23.md.
--
-- Depois desta migration o `db:migrate:from-prisma` passa a gerar diff vazio.
--
-- LOCK TIMEOUT (adicionado depois do deadlock do run 32745879206)
--
-- `SET` de sessao, nao `SET LOCAL`. O `supabase db push` NAO roda o arquivo
-- dentro de um bloco de transacao — `SET LOCAL` so emite
-- `WARNING (25P01): SET LOCAL can only be used in transaction blocks` e nao tem
-- efeito. O `SET` de sessao vale para todas as statements seguintes na mesma
-- conexao, que e o que precisamos aqui, porque quase tudo neste arquivo sao
-- statements soltas e nao blocos DO.
--
-- Por que importa mesmo com as operacoes sendo rapidas: `DROP INDEX` e
-- `ALTER TABLE` pedem ACCESS EXCLUSIVE, e um pedido de lock ENFILEIRADO bloqueia
-- todas as requisicoes que chegam atras dele. O custo nao e a duracao da
-- operacao, e a espera pelo lock. `corretor_studio_radar_profiles` tem 219 MB e
-- 329.777 linhas e e tabela quente do Radar.
--
-- 500ms e curto de proposito: sob contencao esta migration desiste (55P03) em
-- vez de segurar a fila. Reaplicar e seguro — tudo aqui e idempotente
-- (`IF NOT EXISTS`, `IF EXISTS`, guards por catalogo).
--
-- NAO usamos `CREATE INDEX CONCURRENTLY`, e isso foi medido, nao assumido. Dos
-- 8 indices criados aqui, o unico sobre tabela grande
-- (`corretor_studio_radar_profiles_teamId_lastSeenAt_idx`) JA EXISTE em
-- producao, entao o `IF NOT EXISTS` o torna no-op. Os que serao de fato
-- construidos ficam em tabelas de 0 a 3.335 linhas. `CONCURRENTLY` custaria dois
-- scans, nao poderia rodar dentro de bloco DO, e deixaria indice INVALID
-- exigindo limpeza manual se falhasse — pior para este caso.

SET lock_timeout = '500ms';

-- 1. team_whatsapp_configs.webhookSecret ------------------------------------
-- Estado alvo: um único índice ÚNICO chamado
-- `team_whatsapp_configs_webhookSecret_key` (o schema declara `@unique`).
-- A migration 20260618223151_whatsapp-module.sql cria esse índice único; um
-- `@@index([webhookSecret])` posterior criou o `_idx` comum, redundante.
--
-- ATENÇÃO à ordem. Em produção (verificado em 24/08/2026) o `_key` NÃO existe —
-- só o `_idx`. Dropar o `_idx` sem criar o `_key` antes deixaria a coluna sem
-- índice algum e sem a unicidade que a aplicação assume. Verificado: 0 valores
-- de `webhookSecret` duplicados no remoto, então o índice único é seguro.

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_configs_webhookSecret_key"
  ON public.team_whatsapp_configs USING btree ("webhookSecret");

DROP INDEX IF EXISTS "public"."team_whatsapp_configs_webhookSecret_idx";

-- 1b. Índice de FK ausente em produção ---------------------------------------
-- `corretor_studio_leads_referrer_lead_idx` é criado por
-- 20260531173050_add-referral-fields-to-lead.sql, que consta como aplicada no
-- remoto — mas o índice não existe lá e `referrerLeadId` está sem índice
-- nenhum. Recriado aqui; no-op onde já existe.

CREATE INDEX IF NOT EXISTS "corretor_studio_leads_referrer_lead_idx"
  ON public.corretor_studio_leads USING btree ("referrerLeadId");

-- 1c. Índices duplicados que sobraram em produção -----------------------------
-- Nos dois casos o remoto tem o nome antigo E o novo ao mesmo tempo, então o
-- RENAME de 20260824010431 é pulado (destino ocupado) e o antigo ficaria para
-- sempre. Ambos os blocos são no-op onde só existe um dos dois.

DO $$
BEGIN
  -- Definições idênticas: basta remover o nome antigo.
  IF to_regclass('public."whatsapp_auto_response_logs_conversationId_ruleType_createdAt_i"') IS NOT NULL
     AND to_regclass('public."whatsapp_auto_response_logs_conversationId_ruleType_created_idx"') IS NOT NULL THEN
    DROP INDEX "public"."whatsapp_auto_response_logs_conversationId_ruleType_createdAt_i";
  END IF;

END $$;

-- 1d. radar_profiles: qual dos dois índices de lastSeenAt fica ------------------
-- Os dois NÃO são equivalentes, e a assimetria foi deixada de propósito em
-- 20260723222103_radar-dedupe-indexes.sql:
--
--   corretor_studio_radar_profiles_team_last_seen_idx     ("teamId","lastSeenAt" DESC NULLS LAST)
--   corretor_studio_radar_profiles_teamId_lastSeenAt_idx  ("teamId","lastSeenAt" DESC)  -- NULLS FIRST
--
-- O `schema.prisma` declara `@@index([teamId, lastSeenAt(sort: Desc)])`, que o
-- Prisma materializa como `DESC` puro. Verificado com `prisma db push` em base
-- vazia — no banco de dev o índice antigo já existia e o push não o recria só
-- por causa da ordenação de NULL, o que mascarava a diferença.
--
-- Estado alvo: só o do Prisma. Índice não altera resultado de query (a ordem vem
-- do ORDER BY), então dropar o legado muda plano, não resposta.

DROP INDEX IF EXISTS "public"."corretor_studio_radar_profiles_team_last_seen_idx";

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_profiles_teamId_lastSeenAt_idx"
  ON public.corretor_studio_radar_profiles USING btree ("teamId", "lastSeenAt" DESC);

-- 1e. Mesmo caso em whatsapp_conversations ------------------------------------
-- Aqui o nome é o mesmo dos dois lados, então nenhum rename cobria: a migration
-- criou `("teamId","lastMessageAt" DESC NULLS LAST)` e o schema declara
-- `@@index([teamId, lastMessageAt(sort: Desc)])`, que vira `DESC` puro.
-- Só apareceu ao comparar o replay das migrations com um `db push` em base
-- vazia — o banco de dev tinha o índice antigo e mascarava a diferença.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE i.relname = 'whatsapp_conversations_teamId_lastMessageAt_idx'
      AND pg_get_indexdef(i.oid) LIKE '%NULLS LAST%'
  ) THEN
    DROP INDEX "public"."whatsapp_conversations_teamId_lastMessageAt_idx";
    CREATE INDEX "whatsapp_conversations_teamId_lastMessageAt_idx"
      ON public.whatsapp_conversations USING btree ("teamId", "lastMessageAt" DESC);
  END IF;
END $$;

-- 2. Precisão dos timestamps de corretor_studio_radar_pixel_rate_limits ------
-- A migration 20260803004716 criou as colunas como TIMESTAMPTZ (typmod -1);
-- o Prisma emite timestamptz(6). Guardado para não reescrever a tabela quando
-- o tipo já estiver correto.
--
-- O guard usa pg_attribute.atttypmod, e não information_schema.columns:
-- datetime_precision reporta 6 tanto para timestamptz quanto para
-- timestamptz(6), então a comparação por lá nunca dispararia.

-- `backoffice_cnaes` entra junto: o schema declarava os timestamps sem `@db`,
-- o que dava `timestamp(3) without time zone` no Prisma contra `TIMESTAMPTZ` na
-- migration — divergência de verdade, não só de precisão. Ao declarar
-- `@db.Timestamptz(6)` sobra o mesmo ajuste de typmod das outras.
--
-- NOTA: existem ~136 outras colunas `TIMESTAMPTZ` (typmod -1) que um
-- `prisma db push` em base vazia criaria como `timestamptz(6)`. Não estão aqui
-- de propósito: em Postgres `timestamptz` JÁ é precisão 6, então não há
-- diferença de comportamento, e o `supabase db diff` não as reporta porque os
-- dois lados da comparação concordam. Reescrever 136 colunas em produção por
-- cosmético não se paga.

DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('corretor_studio_radar_pixel_rate_limits', 'resetAt'),
      ('corretor_studio_radar_pixel_rate_limits', 'updatedAt'),
      ('backoffice_cnaes', 'createdAt'),
      ('backoffice_cnaes', 'updatedAt')
    ) AS v(tabela, coluna)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass(format('public.%I', alvo.tabela))
        AND attname = alvo.coluna
        AND NOT attisdropped
        AND atttypmod IS DISTINCT FROM 6
    ) THEN
      EXECUTE format(
        'ALTER TABLE "public".%I ALTER COLUMN %I SET DATA TYPE timestamp(6) with time zone',
        alvo.tabela, alvo.coluna
      );
    END IF;
  END LOOP;
END $$;

-- 2b. Normaliza a expressão do default de allowedOrigins ---------------------
-- A migration original escreveu `'{}'::text[]`; o Prisma emite
-- `ARRAY[]::text[]` para `@default([])`. O valor é o mesmo (array vazio), mas o
-- texto guardado em pg_attrdef difere, e o diff reporta a diferença para sempre.
-- Alinhar o banco com o que o Prisma gera é um no-op de comportamento.

ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs"
  ALTER COLUMN "allowedOrigins" SET DEFAULT ARRAY[]::text[];

-- 3. Índices declarados no schema.prisma que nenhuma migration criou ---------

CREATE INDEX IF NOT EXISTS "backoffice_bot_ai_proposals_expiresAt_idx"
  ON public.backoffice_bot_ai_proposals USING btree ("expiresAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_teamId_approvalStatus_idx"
  ON public.corretor_studio_email_templates USING btree ("teamId", "approvalStatus");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_teamId_isCurrentPublished_idx"
  ON public.corretor_studio_email_templates USING btree ("teamId", "isCurrentPublished");

CREATE INDEX IF NOT EXISTS "corretor_studio_health_plan_options_isActive_isDefault_idx"
  ON public.corretor_studio_health_plan_options USING btree ("isActive", "isDefault");

CREATE INDEX IF NOT EXISTS "email_team_variables_teamId_valueSource_idx"
  ON public.email_team_variables USING btree ("teamId", "valueSource");

-- 3b. Reconciliação antes dos índices ÚNICOS ----------------------------------
-- `CREATE UNIQUE INDEX` aborta a migration se houver duplicata. Conferir antes
-- por fora não basta: `WhatsAppContactRepository.findOrCreateCanonical` faz
-- `findFirst` e depois `create` sem upsert, e enquanto a constraint não existe
-- no banco duas requisições concorrentes podem inserir o mesmo par. A janela
-- fica aberta até esta migration rodar, então a reconciliação tem que estar
-- aqui dentro.
--
-- Medido em produção em 24/08/2026: 0 duplicatas nos dois casos. Os blocos
-- abaixo são no-op nesse cenário — existem para o caso de aparecer uma entre a
-- medição e a aplicação.

-- team_whatsapp_contacts: mantém o registro mais antigo e reaponta os
-- dependentes (whatsapp_conversations.contactId, whatsapp_contact_identities.contactId).
DO $$
DECLARE
  grupo record;
BEGIN
  FOR grupo IN
    SELECT "teamId",
           "phoneE164",
           (array_agg(id ORDER BY "createdAt", id))[1] AS manter,
           array_agg(id ORDER BY "createdAt", id)      AS todos
    FROM public.team_whatsapp_contacts
    WHERE "phoneE164" IS NOT NULL
    GROUP BY "teamId", "phoneE164"
    HAVING count(*) > 1
  LOOP
    UPDATE public.whatsapp_conversations
       SET "contactId" = grupo.manter
     WHERE "contactId" = ANY(grupo.todos) AND "contactId" <> grupo.manter;

    UPDATE public.whatsapp_contact_identities
       SET "contactId" = grupo.manter
     WHERE "contactId" = ANY(grupo.todos) AND "contactId" <> grupo.manter;

    DELETE FROM public.team_whatsapp_contacts
     WHERE id = ANY(grupo.todos) AND id <> grupo.manter;

    RAISE NOTICE 'team_whatsapp_contacts: % duplicata(s) consolidada(s) em %',
      array_length(grupo.todos, 1) - 1, grupo.manter;
  END LOOP;
END $$;

-- whatsapp_messages: `clientMessageId` é chave de idempotência do client e é
-- anulável. Zerar nas duplicatas resolve o conflito sem apagar mensagem — o
-- índice é NULLS DISTINCT, então as anuladas deixam de colidir.
DO $$
DECLARE
  afetadas bigint;
BEGIN
  WITH ranqueadas AS (
    SELECT id, row_number() OVER (
             PARTITION BY "teamId", "clientMessageId" ORDER BY "createdAt", id
           ) AS posicao
    FROM public.whatsapp_messages
    WHERE "clientMessageId" IS NOT NULL
  )
  UPDATE public.whatsapp_messages m
     SET "clientMessageId" = NULL
    FROM ranqueadas r
   WHERE m.id = r.id AND r.posicao > 1;

  GET DIAGNOSTICS afetadas = ROW_COUNT;
  IF afetadas > 0 THEN
    RAISE NOTICE 'whatsapp_messages: % clientMessageId duplicado(s) anulado(s)', afetadas;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_contacts_teamId_phoneE164_key"
  ON public.team_whatsapp_contacts USING btree ("teamId", "phoneE164");

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_clientMessageId_key"
  ON public.whatsapp_messages USING btree ("teamId", "clientMessageId");

-- Devolve o lock_timeout ao default. O `SET` acima e de sessao, entao sem isto
-- ele vazaria para as migrations seguintes do mesmo `db push`.
RESET lock_timeout;
