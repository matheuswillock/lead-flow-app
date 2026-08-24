-- Tira a escrita de notificacoes das maos de `anon` e `authenticated`.
--
-- CONTEXTO
--
-- 20260824021510 escopou a policy de SELECT ao destinatario, fechando o
-- vazamento de LEITURA via Realtime. A auditoria que veio depois mostrou que o
-- lado da ESCRITA continuava aberto, e por um caminho mais direto do que RLS.
--
-- `20260524185819_baseline_initial.sql:3160-3186` concede
-- DELETE/INSERT/SELECT/TRIGGER/TRUNCATE/UPDATE nesta tabela para `anon` E
-- `authenticated`, e nenhuma migration posterior revoga. Confirmado no remoto em
-- 24/08/2026. Como o endpoint PostgREST do projeto e alcancavel com a anon key
-- mais o JWT do proprio usuario, esses grants sao explorables independentemente
-- de o app nao usa-los — e as policies passam a ser a unica barreira:
--
--   notifications_insert  -> escopo por time: qualquer membro pode FORJAR uma
--                            notificacao para um colega, e `message` e texto livre
--   notifications_update  -> escopo por time: pode marcar como lida a de outro
--   notifications_delete  -> escopo por time: pode apagar a de outro
--
-- MUDANCA
--
-- Em vez de so apertar os predicados, revogamos a escrita. Auditado: NAO existe
-- uma unica escrita via PostgREST/supabase-js em nenhuma tabela do projeto —
-- zero ocorrencias de `.from("corretor_studio_*")` e zero `.rpc(` em `app/`,
-- `components/`, `hooks/` e `lib/`. Toda escrita de notificacao passa por Prisma
-- (`NotificationService`), com conexao direta que NAO usa esses roles e portanto
-- nao e afetada.
--
-- Revogar e mais robusto que apertar predicado: torna a policy uma segunda
-- camada em vez da unica.
--
-- SELECT NAO e revogado. O Realtime avalia `realtime.apply_rls` no papel
-- `authenticated`; sem SELECT o canal de notificacoes para de entregar.
--
-- As policies de escrita tambem sao apertadas, como defesa em profundidade —
-- se um grant voltar por descuido, o predicado ainda segura.

-- 1. Revoga escrita ---------------------------------------------------------
-- TRUNCATE entra porque nao e filtrado por RLS: e controlado SO pelo grant.
-- PostgREST nao emite TRUNCATE hoje, mas o grant nao tem motivo para existir.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.corretor_studio_notifications
  FROM anon, authenticated;

-- 2. Aperta as policies de escrita ------------------------------------------
--
-- NAO adicionar predicado de membresia de time aqui. `TeamMembersUseCase
-- .removeMember` cria a notificacao TEAM_MEMBER_REMOVED e SO DEPOIS apaga a
-- linha de `team_members` — exigir membresia faria essa notificacao falhar a RLS
-- no instante seguinte a ser criada. Ver 20260824021510 linhas 31-39.
--
-- Ser o destinatario ja e autorizacao suficiente e correta.

DROP POLICY IF EXISTS notifications_update ON public.corretor_studio_notifications;

-- `WITH CHECK` alem de `USING` e proposital: com `USING` sozinho o usuario pode
-- editar uma linha que e dele e trocar o `recipientProfileId` para outra pessoa,
-- "doando" a linha. O `WITH CHECK` valida a linha DEPOIS da alteracao.
CREATE POLICY notifications_update ON public.corretor_studio_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = corretor_studio_notifications."recipientProfileId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = corretor_studio_notifications."recipientProfileId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS notifications_delete ON public.corretor_studio_notifications;

CREATE POLICY notifications_delete ON public.corretor_studio_notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = corretor_studio_notifications."recipientProfileId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
  );

-- INSERT nao tem `USING` (nao existe linha anterior), so `WITH CHECK`. O escopo
-- por time permitia forjar notificacao para colega; agora so para si mesmo — o
-- que, com o grant revogado, ninguem consegue fazer por PostgREST de qualquer
-- forma. Escrita legitima e sempre server-side via Prisma.

DROP POLICY IF EXISTS notifications_insert ON public.corretor_studio_notifications;

CREATE POLICY notifications_insert ON public.corretor_studio_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = corretor_studio_notifications."recipientProfileId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
  );
