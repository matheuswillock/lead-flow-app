-- Alinha a cláusula ON UPDATE das FKs com a que o Prisma gera — lote 5/6.
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
-- 32 constraint(s) em 8 tabela(s):
--   whatsapp_contact_identities
--   whatsapp_conversations
--   whatsapp_message_action_commands
--   whatsapp_message_favorites
--   whatsapp_message_pins
--   whatsapp_message_reactions
--   whatsapp_message_visibility
--   whatsapp_messages
--
-- Idempotente: cada bloco só roda se a definição atual ainda for a antiga.

-- LOCK e DDL no MESMO bloco DO. O `supabase db push` NAO roda o arquivo dentro
-- de um bloco de transacao (confirmado no run 32752152486: `WARNING (25P01):
-- SET LOCAL can only be used in transaction blocks`), entao um `SET LOCAL` de
-- arquivo nao tem efeito e cada statement vira sua propria transacao — um bloco
-- DO so de lock liberaria tudo antes de o DDL comecar. Ver o lote 3 para o
-- registro completo.
--
-- Trava tudo de uma vez, em ordem de dependencia de FK, ANTES de qualquer DDL.
-- Mesma correcao do lote 3, que falhou em producao com deadlock (SQLSTATE
-- 40P01, run 32745879206): `lock_timeout` limita espera, nao evita deadlock —
-- o `deadlock_timeout` (1s) aborta antes. A aquisicao incremental de lock
-- dentro do bloco DO era a causa. A ordem e a TOPOLOGICA do grafo de FK — pai
-- antes de filha — e MUST ser a mesma em todos os lotes desta serie.
-- O LOCK e condicional pelo mesmo motivo que os guards abaixo usam
-- `to_regclass`: nem toda tabela existe em toda base (replay local, ambiente
-- parcial). Um `LOCK TABLE` cru aborta com "relation does not exist" e quebra
-- o `db:migrate:reset:local`.
DO $$
DECLARE
  target text;
BEGIN
  -- 500ms fica abaixo do deadlock_timeout (1s) de proposito: sob contencao a
  -- migration aborta com 55P03 antes de o detector escolher uma vitima. A
  -- vitima e arbitraria, e na reproducao local quem morreu foi a sessao da
  -- aplicacao. Com o timeout curto quem cede e sempre a migration.
  PERFORM set_config('lock_timeout', '500ms', true);

  -- Ordem topologica do grafo de FK: PAI antes de FILHA. Nao alfabetica.
  -- Aqui a inversao alfabetica era grosseira: `whatsapp_message_*` viria antes
  -- de `whatsapp_messages`, que e a tabela pai de todas elas.
  FOREACH target IN ARRAY ARRAY[
    'public.corretor_studio_profiles',
    'public.corretor_studio_teams',
    'public.corretor_studio_leads',
    'public.team_whatsapp_configs',
    'public.team_whatsapp_contacts',
    'public.whatsapp_auto_response_rules',
    'public.whatsapp_contact_identities',
    'public.whatsapp_conversations',
    'public.whatsapp_messages',
    'public.whatsapp_message_action_commands',
    'public.whatsapp_message_favorites',
    'public.whatsapp_message_pins',
    'public.whatsapp_message_reactions',
    'public.whatsapp_message_visibility'
  ] LOOP
    IF to_regclass(target) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_teamId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_configId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_contact_identities_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_contact_identities"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_contact_identities" DROP CONSTRAINT "whatsapp_contact_identities_contactId_fkey";
    ALTER TABLE "public"."whatsapp_contact_identities" ADD CONSTRAINT "whatsapp_contact_identities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_teamId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_configId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_leadId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_assignedProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("assignedProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assignedProfileId_fkey" FOREIGN KEY ("assignedProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_contactId_fkey'
      AND conrelid = to_regclass('public."whatsapp_conversations"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_contactId_fkey";
    ALTER TABLE "public"."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES team_whatsapp_contacts(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_action_commands_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_action_commands"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_action_commands" DROP CONSTRAINT "whatsapp_message_action_commands_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_action_commands" ADD CONSTRAINT "whatsapp_message_action_commands_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_favorites_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_favorites"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_favorites" DROP CONSTRAINT "whatsapp_message_favorites_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_favorites" ADD CONSTRAINT "whatsapp_message_favorites_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_pins_pinnedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_pins"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("pinnedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_pins" DROP CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_message_pins" ADD CONSTRAINT "whatsapp_message_pins_pinnedByProfileId_fkey" FOREIGN KEY ("pinnedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_reactions_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_reactions"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_reactions" DROP CONSTRAINT "whatsapp_message_reactions_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_reactions" ADD CONSTRAINT "whatsapp_message_reactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_teamId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_messageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_messageId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_message_visibility_profileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_message_visibility"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_message_visibility" DROP CONSTRAINT "whatsapp_message_visibility_profileId_fkey";
    ALTER TABLE "public"."whatsapp_message_visibility" ADD CONSTRAINT "whatsapp_message_visibility_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_conversationId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_conversationId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_teamId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_teamId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_configId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON DELETE CASCADE'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_configId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_configId_fkey" FOREIGN KEY ("configId") REFERENCES team_whatsapp_configs(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_leadId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_leadId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_sentByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("sentByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_sentByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sentByProfileId_fkey" FOREIGN KEY ("sentByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_autoResponseRuleId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("autoResponseRuleId") REFERENCES whatsapp_auto_response_rules(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_autoResponseRuleId_fkey" FOREIGN KEY ("autoResponseRuleId") REFERENCES whatsapp_auto_response_rules(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_quotedMessageId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("quotedMessageId") REFERENCES whatsapp_messages(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_quotedMessageId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES whatsapp_messages(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_deletedByProfileId_fkey'
      AND conrelid = to_regclass('public."whatsapp_messages"')
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY ("deletedByProfileId") REFERENCES corretor_studio_profiles(id) ON DELETE SET NULL'
  ) THEN
    ALTER TABLE "public"."whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey";
    ALTER TABLE "public"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey" FOREIGN KEY ("deletedByProfileId") REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
