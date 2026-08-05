-- D12: RLS for Radar pixel tables (TeamRadarPixelConfig, TeamRadarPixelHitLog, rate limits).
--
-- Application access today is via the Prisma service-role client, which bypasses RLS.
-- These policies protect client-side/realtime access paths that may be added later
-- (mirrors team webhooks / studio webhook manager-only model).
-- Rate-limit table is server-only: RLS enabled with no Data API policies.
-- Hit logs are immutable to authenticated clients: manager-only SELECT; writes via service_role.

ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_radar_pixel_rate_limits" ENABLE ROW LEVEL SECURITY;

-- ─── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE "public"."corretor_studio_team_radar_pixel_configs" FROM anon;
REVOKE ALL ON TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" FROM anon;
REVOKE ALL ON TABLE "public"."corretor_studio_radar_pixel_rate_limits" FROM anon;

REVOKE ALL ON TABLE "public"."corretor_studio_team_radar_pixel_configs" FROM authenticated;
REVOKE ALL ON TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" FROM authenticated;
REVOKE ALL ON TABLE "public"."corretor_studio_radar_pixel_rate_limits" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."corretor_studio_team_radar_pixel_configs" TO authenticated;
GRANT SELECT ON TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" TO authenticated;

GRANT ALL ON TABLE "public"."corretor_studio_team_radar_pixel_configs" TO service_role;
GRANT ALL ON TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" TO service_role;
GRANT ALL ON TABLE "public"."corretor_studio_radar_pixel_rate_limits" TO service_role;

-- ─── pixel configs: CRUD for team managers (aligns with getRadarAccess) ───────
DROP POLICY IF EXISTS "radar_pixel_configs_select" ON "public"."corretor_studio_team_radar_pixel_configs";
CREATE POLICY "radar_pixel_configs_select" ON "public"."corretor_studio_team_radar_pixel_configs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_configs"."teamId"
        AND tm.role = 'manager'
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
        AND tm.role = 'manager'
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
        AND tm.role = 'manager'
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
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- ─── hit logs: SELECT for managers only (writes via service_role pixel endpoint)
DROP POLICY IF EXISTS "radar_pixel_hit_logs_select" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
CREATE POLICY "radar_pixel_hit_logs_select" ON "public"."corretor_studio_team_radar_pixel_hit_logs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_radar_pixel_hit_logs"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- Drop any prior write policies so authenticated clients cannot forge/erase the audit trail.
DROP POLICY IF EXISTS "radar_pixel_hit_logs_insert" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
DROP POLICY IF EXISTS "radar_pixel_hit_logs_update" ON "public"."corretor_studio_team_radar_pixel_hit_logs";
DROP POLICY IF EXISTS "radar_pixel_hit_logs_delete" ON "public"."corretor_studio_team_radar_pixel_hit_logs";

-- Rate limits: RLS on, no policies — only service-role / server Prisma path.
