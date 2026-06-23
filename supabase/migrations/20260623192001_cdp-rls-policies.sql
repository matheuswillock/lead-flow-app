-- Migration: cdp-rls-policies
-- Team-scoped RLS for CDP tables

ALTER TABLE "public"."corretor_studio_cdp_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_cdp_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_cdp_source_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_cdp_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_cdp_channel_consents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdp_profiles_select" ON "public"."corretor_studio_cdp_profiles"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_profiles"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_profiles_insert" ON "public"."corretor_studio_cdp_profiles"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_profiles"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_profiles_update" ON "public"."corretor_studio_cdp_profiles"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_profiles"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_profiles_delete" ON "public"."corretor_studio_cdp_profiles"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_profiles"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_identities_select" ON "public"."corretor_studio_cdp_identities"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_identities"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_identities_insert" ON "public"."corretor_studio_cdp_identities"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_identities"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_identities_update" ON "public"."corretor_studio_cdp_identities"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_identities"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_identities_delete" ON "public"."corretor_studio_cdp_identities"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_identities"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_source_links_select" ON "public"."corretor_studio_cdp_source_links"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_source_links"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_source_links_insert" ON "public"."corretor_studio_cdp_source_links"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_source_links"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_source_links_update" ON "public"."corretor_studio_cdp_source_links"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_source_links"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_source_links_delete" ON "public"."corretor_studio_cdp_source_links"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_source_links"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_events_select" ON "public"."corretor_studio_cdp_events"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_events"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_events_insert" ON "public"."corretor_studio_cdp_events"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_events"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_events_update" ON "public"."corretor_studio_cdp_events"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_events"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_events_delete" ON "public"."corretor_studio_cdp_events"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_events"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_channel_consents_select" ON "public"."corretor_studio_cdp_channel_consents"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_channel_consents"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_channel_consents_insert" ON "public"."corretor_studio_cdp_channel_consents"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_channel_consents"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_channel_consents_update" ON "public"."corretor_studio_cdp_channel_consents"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_channel_consents"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "cdp_channel_consents_delete" ON "public"."corretor_studio_cdp_channel_consents"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_cdp_channel_consents"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );
