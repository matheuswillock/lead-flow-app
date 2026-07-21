-- C1: RLS for Lead custom field tables + query index for custom field filters (C2).
--
-- Application access today is via the Prisma service-role client, which bypasses RLS.
-- These policies protect client-side/realtime access paths that may be added later
-- (mirrors the pattern already used for corretor_studio_radar_* tables), so enabling
-- RLS now costs nothing in the current request path and closes the gap in advance.

ALTER TABLE "public"."corretor_studio_lead_custom_field_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_lead_custom_field_values" ENABLE ROW LEVEL SECURITY;

-- Definitions: teamId lives on the row itself.
DROP POLICY IF EXISTS "lead_custom_field_definitions_select" ON "public"."corretor_studio_lead_custom_field_definitions";
CREATE POLICY "lead_custom_field_definitions_select" ON "public"."corretor_studio_lead_custom_field_definitions"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_lead_custom_field_definitions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_definitions_insert" ON "public"."corretor_studio_lead_custom_field_definitions";
CREATE POLICY "lead_custom_field_definitions_insert" ON "public"."corretor_studio_lead_custom_field_definitions"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_lead_custom_field_definitions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_definitions_update" ON "public"."corretor_studio_lead_custom_field_definitions";
CREATE POLICY "lead_custom_field_definitions_update" ON "public"."corretor_studio_lead_custom_field_definitions"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_lead_custom_field_definitions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_definitions_delete" ON "public"."corretor_studio_lead_custom_field_definitions";
CREATE POLICY "lead_custom_field_definitions_delete" ON "public"."corretor_studio_lead_custom_field_definitions"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_lead_custom_field_definitions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- Values: no teamId on the row — derive team membership via leadId → corretor_studio_leads.teamId.
DROP POLICY IF EXISTS "lead_custom_field_values_select" ON "public"."corretor_studio_lead_custom_field_values";
CREATE POLICY "lead_custom_field_values_select" ON "public"."corretor_studio_lead_custom_field_values"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_leads" l
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = l."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE l.id = "corretor_studio_lead_custom_field_values"."leadId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_values_insert" ON "public"."corretor_studio_lead_custom_field_values";
CREATE POLICY "lead_custom_field_values_insert" ON "public"."corretor_studio_lead_custom_field_values"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_leads" l
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = l."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE l.id = "corretor_studio_lead_custom_field_values"."leadId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_values_update" ON "public"."corretor_studio_lead_custom_field_values";
CREATE POLICY "lead_custom_field_values_update" ON "public"."corretor_studio_lead_custom_field_values"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_leads" l
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = l."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE l.id = "corretor_studio_lead_custom_field_values"."leadId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lead_custom_field_values_delete" ON "public"."corretor_studio_lead_custom_field_values";
CREATE POLICY "lead_custom_field_values_delete" ON "public"."corretor_studio_lead_custom_field_values"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_leads" l
      JOIN "public"."corretor_studio_team_members" tm ON tm."teamId" = l."teamId"
      JOIN "public"."corretor_studio_profiles" p ON p.id = tm."profileId"
      WHERE l.id = "corretor_studio_lead_custom_field_values"."leadId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );

-- Query index for C2 (custom field filters/sort in CRM + board).
-- "value" is jsonb, which has a default btree opclass, so a plain composite btree
-- index supports equality lookups like `definitionId = X AND value = '"Y"'::jsonb`
-- without needing GIN/btree_gin — the composite form works directly.
CREATE INDEX IF NOT EXISTS "lead_custom_field_values_definition_value_idx"
  ON "public"."corretor_studio_lead_custom_field_values" ("definitionId", "value");
