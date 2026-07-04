-- WhatsApp RBAC-alvo (Estágio 1): mirror buildConversationVisibilityWhere in RLS
-- master/manager-like = all team conversations; operator = assigned OR unassigned OR lead clauses

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
        OR tm.role IN ('manager'::public."UserRole", 'backoffice'::public."UserRole")
        OR (
          tm.role = 'operator'::public."UserRole"
          AND (
            conv."assignedProfileId" = p.id
            OR conv."assignedProfileId" IS NULL
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

REVOKE SELECT ON public.whatsapp_conversations, public.whatsapp_messages FROM anon;
