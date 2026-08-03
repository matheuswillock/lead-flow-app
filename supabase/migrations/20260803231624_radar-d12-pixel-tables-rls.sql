-- D12: RLS for Radar pixel tables (TeamRadarPixelConfig, TeamRadarPixelHitLog, rate limits).
--
-- Application access today is via the Prisma service-role client, which bypasses RLS.
-- These policies protect client-side/realtime access paths that may be added later
-- (mirrors corretor_studio_radar_segments / corretor_studio_radar_* patterns).
-- Rate-limit table is server-only: RLS enabled with no Data API policies.

ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_radar_pixel_rate_limits" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar_pixel_configs_select" ON "public"."corretor_studio_team_radar_pixel_configs";
CREATE POLICY "radar_pixel_configs_select" ON "public"."corretor_studio_team_radar_pixel_configs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_configs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_configs_insert" ON "public"."corretor_studio_team_radar_pixel_configs";
CREATE POLICY "radar_pixel_configs_insert" ON "public"."corretor_studio_team_radar_pixel_configs"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_configs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_configs_update" ON "public"."corretor_studio_team_radar_pixel_configs";
CREATE POLICY "radar_pixel_configs_update" ON "public"."corretor_studio_team_radar_pixel_configs"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_configs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_configs_delete" ON "public"."corretor_studio_team_radar_pixel_configs";
CREATE POLICY "radar_pixel_configs_delete" ON "public"."corretor_studio_team_radar_pixel_configs"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_configs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_hit_logs_select" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
CREATE POLICY "radar_pixel_hit_logs_select" ON "public"."corretor_studio_team_radar_pixel_hit_logs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_hit_logs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_hit_logs_insert" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
CREATE POLICY "radar_pixel_hit_logs_insert" ON "public"."corretor_studio_team_radar_pixel_hit_logs"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_hit_logs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_hit_logs_update" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
CREATE POLICY "radar_pixel_hit_logs_update" ON "public"."corretor_studio_team_radar_pixel_hit_logs"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_hit_logs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "radar_pixel_hit_logs_delete" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
CREATE POLICY "radar_pixel_hit_logs_delete" ON "public"."corretor_studio_team_radar_pixel_hit_logs"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_hit_logs"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- Rate limits: RLS on, no policies — only service-role / server Prisma path.
