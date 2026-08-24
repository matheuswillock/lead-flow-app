-- Restringe a policy de leitura de notificacoes ao proprio destinatario.
--
-- CONTEXTO
--
-- A migration 20260823001928_realtime-publication-fix.sql publicou
-- `corretor_studio_notifications` na `supabase_realtime` para consertar as
-- notificacoes, que so atualizavam ao recarregar a pagina. Isso estava certo,
-- mas expos um problema que ate entao era latente.
--
-- A policy `notifications_select` autoriza por MEMBRESIA DE TIME:
--
--   EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ...
--           WHERE tm."teamId" = notifications."teamId" AND p = auth.uid())
--
-- Ou seja, qualquer membro do time pode ler QUALQUER notificacao daquele time,
-- independentemente de `recipientProfileId`. Enquanto a tabela nao estava
-- publicada, isso quase nao aparecia: o app le notificacoes via Prisma, que nao
-- passa por RLS e filtra por destinatario na propria query.
--
-- Com a tabela publicada, a RLS passou a ser a UNICA fronteira do lado servidor
-- para o Realtime. O filtro do canal
-- (`recipientProfileId=eq.<id>` em NotificationsContext) e declarado pelo
-- cliente e, portanto, nao e fronteira de seguranca: basta assinar sem ele para
-- receber as notificacoes dos colegas de time — e `Notification.message` e
-- texto livre.
--
-- MUDANCA
--
-- A policy passa a exigir que o leitor seja o destinatario. A checagem de time
-- e mantida como defesa adicional, para que um `recipientProfileId` de outra
-- conta nunca case mesmo em caso de dado inconsistente.
--
-- O `(SELECT auth.uid())` em subselect e proposital: a policy e avaliada pelo
-- realtime.apply_rls a cada linha do WAL, por subscriber, e o subselect faz o
-- planner resolver a funcao uma vez (InitPlan) em vez de por linha.
--
-- Nenhum caminho legitimo perde acesso: a leitura server-side usa Prisma
-- (NotificationService), que nao passa por RLS, e o canal do cliente ja filtra
-- pelo proprio destinatario.

DROP POLICY IF EXISTS notifications_select ON public.corretor_studio_notifications;

CREATE POLICY notifications_select ON public.corretor_studio_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = corretor_studio_notifications."recipientProfileId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
    AND EXISTS (
      SELECT 1
      FROM public.corretor_studio_team_members tm
      WHERE tm."teamId" = corretor_studio_notifications."teamId"
        AND tm."profileId" = corretor_studio_notifications."recipientProfileId"
    )
  );
