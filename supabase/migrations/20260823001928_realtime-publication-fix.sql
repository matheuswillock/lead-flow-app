-- Corrige a divergência entre o que o app assina no Realtime e o que a
-- publicação `supabase_realtime` de fato publica.
--
-- Estado antes desta migration (verificado em produção via pg_publication_tables):
--   publicadas: whatsapp_messages, whatsapp_conversations,
--               corretor_studio_lead_activities, corretor_studio_profiles,
--               corretor_studio_lead_activity_reactions
--
-- Dois problemas:
--
-- 1. `corretor_studio_notifications` NÃO estava publicada, mas
--    NotificationsContext.tsx abre canal nela para todo usuário logado. O canal
--    assina com sucesso, roda syncFromServer() uma vez no SUBSCRIBED e nunca
--    mais recebe evento — não há erro nem polling de fallback. Na prática,
--    notificações só atualizavam ao carregar a página.
--
-- 2. `corretor_studio_profiles` estava publicada desde
--    20260524200028_functions_rls_realtime.sql, mas nenhum canal do app a
--    consome. Toda escrita em profiles gerava trabalho de WAL sem destino.
--
-- As tabelas de WhatsApp foram investigadas e permanecem publicadas: apesar de
-- zero escritas na janela medida, o código está ativo (WhatsAppRepository tem
-- create/update em ambos os models). O REPLICA IDENTITY FULL delas também
-- permanece — é exigido pelos filtros de UPDATE dos canais.

-- 1) Publica notifications (RLS já habilitada, policy `notifications_select`
--    para o papel authenticated já existe).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.corretor_studio_notifications;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'corretor_studio_notifications já está na publicação supabase_realtime';
END $$;

-- 2) Remove profiles da publicação (sem consumidor no app).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.corretor_studio_profiles;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'corretor_studio_profiles não estava na publicação supabase_realtime';
END $$;

-- 3) REPLICA IDENTITY FULL em lead_activity_reactions.
--
--    O hook useLeadActivitiesRealtime assina DELETE nessa tabela e lê
--    `payload.old.activityId` para saber qual atividade atualizar, além de
--    aplicar `filter` no evento de DELETE. Com REPLICA IDENTITY default o WAL
--    carrega apenas a chave primária na linha antiga, então `activityId` chega
--    undefined e o handler aborta — e o filtro não tem como ser avaliado.
--
--    Custo desprezível: a tabela tem 80 kB e volume de escrita próximo de zero.
ALTER TABLE public.corretor_studio_lead_activity_reactions REPLICA IDENTITY FULL;

-- 4) Otimiza a policy de notifications para avaliação por linha.
--
--    Esta migration torna a policy "quente": ela passa a ser avaliada pelo
--    realtime.apply_rls a cada linha do WAL, por subscriber. Com `auth.uid()`
--    chamado diretamente, o Postgres reavalia a função para cada linha; dentro
--    de um subselect, o plano vira InitPlan e avalia uma vez.
--
--    Mudança semanticamente idêntica — é a correção documentada pelo Supabase
--    para o aviso `auth_rls_initplan`.
DROP POLICY IF EXISTS notifications_select ON public.corretor_studio_notifications;

CREATE POLICY notifications_select ON public.corretor_studio_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM corretor_studio_team_members tm
      JOIN corretor_studio_profiles p ON p.id = tm."profileId"
      WHERE tm."teamId" = corretor_studio_notifications."teamId"
        AND (p."supabaseId" = (SELECT auth.uid()) OR p.id = (SELECT auth.uid()))
    )
  );
