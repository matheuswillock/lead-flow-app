-- RLS policies for associate proposal review + required documents
-- Idempotent via IF NOT EXISTS on policy names.

DO $$ BEGIN
  CREATE POLICY "lead_proposal_reviews_select"
    ON public.corretor_studio_lead_proposal_reviews
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_proposal_reviews."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_proposal_reviews_insert"
    ON public.corretor_studio_lead_proposal_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_proposal_reviews."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_proposal_reviews_update"
    ON public.corretor_studio_lead_proposal_reviews
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_proposal_reviews."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_proposal_reviews_delete"
    ON public.corretor_studio_lead_proposal_reviews
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_proposal_reviews."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_required_documents_select"
    ON public.corretor_studio_lead_required_documents
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_required_documents."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_required_documents_insert"
    ON public.corretor_studio_lead_required_documents
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_required_documents."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_required_documents_update"
    ON public.corretor_studio_lead_required_documents
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_required_documents."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lead_required_documents_delete"
    ON public.corretor_studio_lead_required_documents
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.corretor_studio_leads l
        JOIN public.corretor_studio_team_members tm ON tm."teamId" = l."teamId"
        JOIN public.corretor_studio_profiles p ON p.id = tm."profileId"
        WHERE l.id = corretor_studio_lead_required_documents."leadId"
          AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
