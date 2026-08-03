-- D12: RLS for D7 pixel tables.
--
-- Application access is via the Prisma service-role client (bypasses RLS).
-- These policies protect client-side/realtime access paths that may be added later,
-- mirroring the pattern used for corretor_studio_radar_segments (C4) and
-- corretor_studio_cdp_* tables.
--
-- corretor_studio_team_radar_pixel_configs  — team-scoped: only team members can read/write
-- corretor_studio_team_radar_pixel_hit_logs — team-scoped: only team members can read/write
-- corretor_studio_radar_pixel_rate_limits   — no auth needed (internal write path via service role);
--                                             no client access expected, so deny all authenticated access.

-- ── pixel_configs ──────────────────────────────────────────────────────────────

ALTER TABLE "public"."corretor_studio_team_radar_pixel_configs" ENABLE ROW LEVEL SECURITY;

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

-- ── pixel_hit_logs ─────────────────────────────────────────────────────────────

ALTER TABLE "public"."corretor_studio_team_radar_pixel_hit_logs" ENABLE ROW LEVEL SECURITY;

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

-- ── pixel_rate_limits ──────────────────────────────────────────────────────────
-- Internal-only table written exclusively by the service-role client (rate-limit window).
-- No direct client/realtime access is expected — enable RLS and deny all authenticated
-- access to prevent accidental exposure.

ALTER TABLE "public"."corretor_studio_radar_pixel_rate_limits" ENABLE ROW LEVEL SECURITY;
