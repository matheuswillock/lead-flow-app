-- RLS for Team Webhooks (inbound/outbound).
-- Application access is via Prisma service_role (bypasses RLS).
-- Policies protect PostgREST / client paths; mirror legacy Studio Webhook manager-only model.
-- Outbox has no authenticated policies (deny-all for JWT; service_role only).

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE "public"."corretor_studio_team_webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_team_webhook_event_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_team_webhook_outbox" ENABLE ROW LEVEL SECURITY;

-- ─── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhooks" FROM anon;
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhook_event_logs" FROM anon;
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhook_outbox" FROM anon;

REVOKE ALL ON TABLE "public"."corretor_studio_team_webhooks" FROM authenticated;
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhook_event_logs" FROM authenticated;
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhook_outbox" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."corretor_studio_team_webhooks" TO authenticated;
GRANT SELECT ON TABLE "public"."corretor_studio_team_webhook_event_logs" TO authenticated;

GRANT ALL ON TABLE "public"."corretor_studio_team_webhooks" TO service_role;
GRANT ALL ON TABLE "public"."corretor_studio_team_webhook_event_logs" TO service_role;
GRANT ALL ON TABLE "public"."corretor_studio_team_webhook_outbox" TO service_role;

-- ─── team_webhooks: CRUD for team managers ───────────────────────────────────
DROP POLICY IF EXISTS "team_webhooks_select" ON "public"."corretor_studio_team_webhooks";
CREATE POLICY "team_webhooks_select" ON "public"."corretor_studio_team_webhooks"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_webhooks"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "team_webhooks_insert" ON "public"."corretor_studio_team_webhooks";
CREATE POLICY "team_webhooks_insert" ON "public"."corretor_studio_team_webhooks"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_webhooks"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "team_webhooks_update" ON "public"."corretor_studio_team_webhooks";
CREATE POLICY "team_webhooks_update" ON "public"."corretor_studio_team_webhooks"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_webhooks"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "team_webhooks_delete" ON "public"."corretor_studio_team_webhooks";
CREATE POLICY "team_webhooks_delete" ON "public"."corretor_studio_team_webhooks"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_webhooks"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- ─── event_logs: SELECT for managers only (writes via service_role) ──────────
DROP POLICY IF EXISTS "team_webhook_event_logs_select" ON "public"."corretor_studio_team_webhook_event_logs";
CREATE POLICY "team_webhook_event_logs_select" ON "public"."corretor_studio_team_webhook_event_logs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_team_webhook_event_logs"."teamId"
        AND tm.role = 'manager'
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- ─── outbox: RLS enabled, no authenticated policies (deny-all for JWT) ───────
-- Intentionally no CREATE POLICY for authenticated on outbox.
