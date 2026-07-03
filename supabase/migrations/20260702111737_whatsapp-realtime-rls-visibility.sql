-- WhatsApp Realtime RLS: mirror API conversation visibility (buildConversationVisibilityWhere)

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN '';
  END IF;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');

  IF v_digits LIKE '55%' AND length(v_digits) >= 12 THEN
    RETURN v_digits;
  END IF;

  IF length(v_digits) IN (10, 11) THEN
    RETURN '55' || v_digits;
  END IF;

  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_user_can_view_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations conv
    JOIN public.corretor_studio_teams t ON t.id = conv."teamId"
    JOIN public.corretor_studio_team_members tm ON tm."teamId" = conv."teamId"
    JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
    WHERE conv.id = p_conversation_id
      AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      AND (
        t."masterId" = p.id
        OR (
          tm.role IN ('manager'::public."UserRole", 'backoffice'::public."UserRole")
          AND (
            conv."assignedProfileId" = p.id
            OR conv."createdByProfileId" = p.id
            OR conv."assignedProfileId" IN (
              SELECT tm_op."profileId"
              FROM public.corretor_studio_team_members tm_op
              WHERE tm_op."teamId" = conv."teamId"
                AND tm_op.role = 'operator'::public."UserRole"
            )
            OR conv."createdByProfileId" IN (
              SELECT tm_op."profileId"
              FROM public.corretor_studio_team_members tm_op
              WHERE tm_op."teamId" = conv."teamId"
                AND tm_op.role = 'operator'::public."UserRole"
            )
            OR EXISTS (
              SELECT 1
              FROM public.whatsapp_messages wm
              WHERE wm."conversationId" = conv.id
                AND wm."sentByProfileId" IN (
                  SELECT tm_op."profileId"
                  FROM public.corretor_studio_team_members tm_op
                  WHERE tm_op."teamId" = conv."teamId"
                    AND tm_op.role = 'operator'::public."UserRole"
                )
            )
          )
        )
        OR (
          tm.role = 'operator'::public."UserRole"
          AND (
            conv."assignedProfileId" = p.id
            OR EXISTS (
              SELECT 1
              FROM public.corretor_studio_leads l
              WHERE l.id = conv."leadId"
                AND l."teamId" = conv."teamId"
                AND (l."assignedTo" = p.id OR l."closerId" = p.id)
            )
            OR (
              conv."leadId" IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.corretor_studio_leads l
                WHERE l."teamId" = conv."teamId"
                  AND l.phone IS NOT NULL
                  AND (l."assignedTo" = p.id OR l."closerId" = p.id)
                  AND public.normalize_whatsapp_phone(l.phone) = conv."normalizedPhone"
              )
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS "whatsapp_conversations_realtime_select" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_realtime_select" ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (public.whatsapp_user_can_view_conversation(id));

DROP POLICY IF EXISTS "whatsapp_messages_realtime_select" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_realtime_select" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.whatsapp_user_can_view_conversation("conversationId"));
