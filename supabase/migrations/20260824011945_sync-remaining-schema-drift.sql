-- Últimos itens de estrutura que existiam só de um lado da fronteira
-- schema.prisma <-> supabase/migrations. Ver §7.5 de
-- docs/audits/prisma-migrations-drift-2026-08-23.md.
--
-- Depois desta migration o `db:migrate:from-prisma` passa a gerar diff vazio.

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

DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['resetAt', 'updatedAt']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('public."corretor_studio_radar_pixel_rate_limits"')
        AND attname = col
        AND NOT attisdropped
        AND atttypmod IS DISTINCT FROM 6
    ) THEN
      EXECUTE format(
        'ALTER TABLE "public"."corretor_studio_radar_pixel_rate_limits" ALTER COLUMN %I SET DATA TYPE timestamp(6) with time zone',
        col
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

-- ATENÇÃO: os dois índices ÚNICOS abaixo falham se o remoto tiver duplicata.
-- Ambos já estão declarados como @@unique no schema.prisma, então a aplicação
-- assume a unicidade — mas confirme antes de aplicar em produção:
--   SELECT "teamId", "phoneE164", count(*) FROM public.team_whatsapp_contacts
--   GROUP BY 1,2 HAVING count(*) > 1;
--   SELECT "teamId", "clientMessageId", count(*) FROM public.whatsapp_messages
--   WHERE "clientMessageId" IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "team_whatsapp_contacts_teamId_phoneE164_key"
  ON public.team_whatsapp_contacts USING btree ("teamId", "phoneE164");

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_teamId_clientMessageId_key"
  ON public.whatsapp_messages USING btree ("teamId", "clientMessageId");
