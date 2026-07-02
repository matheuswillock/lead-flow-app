-- WhatsApp Realtime: grants, RLS policies and replica identity for postgres_changes

GRANT SELECT ON public.whatsapp_conversations, public.whatsapp_messages TO authenticated, anon;

ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_conversations_realtime_select" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_realtime_select" ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_team_members tm
      JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
      WHERE tm."teamId" = whatsapp_conversations."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "whatsapp_messages_realtime_select" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_realtime_select" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.whatsapp_conversations conv
      JOIN public.corretor_studio_team_members tm ON tm."teamId" = conv."teamId"
      JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
      WHERE conv.id = whatsapp_messages."conversationId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );
