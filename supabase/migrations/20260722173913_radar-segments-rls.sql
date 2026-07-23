-- C4: RLS for corretor_studio_radar_segments (custom TeamRadarSegment rows).
--
-- Application access today is via the Prisma service-role client, which bypasses RLS.
-- These policies protect client-side/realtime access paths that may be added later
-- (mirrors the pattern already used for corretor_studio_radar_* and
-- corretor_studio_lead_custom_field_* tables), so enabling RLS now costs nothing in
-- the current request path and closes the gap in advance.

ALTER TABLE "public"."corretor_studio_radar_segments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar_segments_select" ON "public"."corretor_studio_radar_segments";
CREATE POLICY "radar_segments_select" ON "public"."corretor_studio_radar_segments"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_radar_segments"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_segments_insert" ON "public"."corretor_studio_radar_segments";
CREATE POLICY "radar_segments_insert" ON "public"."corretor_studio_radar_segments"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_radar_segments"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_segments_update" ON "public"."corretor_studio_radar_segments";
CREATE POLICY "radar_segments_update" ON "public"."corretor_studio_radar_segments"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_radar_segments"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_segments_delete" ON "public"."corretor_studio_radar_segments";
CREATE POLICY "radar_segments_delete" ON "public"."corretor_studio_radar_segments"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_radar_segments"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );
