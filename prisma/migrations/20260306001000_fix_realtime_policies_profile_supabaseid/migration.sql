-- Fix realtime RLS identity mapping:
-- team_members.profileId references profiles.id, while authenticated identity is auth.uid() == profiles.supabaseId.

DROP POLICY IF EXISTS "lead_activities_realtime_select" ON "lead_activities";
CREATE POLICY "lead_activities_realtime_select"
ON "lead_activities"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "leads" l
    JOIN "team_members" tm
      ON tm."teamId" = l."teamId"
    JOIN "profiles" p
      ON p."id" = tm."profileId"
    WHERE l."id" = "lead_activities"."leadId"
      AND (
        p."supabaseId" = auth.uid()
        OR p."id" = auth.uid()
      )
      AND (
        tm."role" = 'manager'::"UserRole"
        OR 'SDR'::"UserFunction" = ANY (tm."functions")
        OR 'CLOSER'::"UserFunction" = ANY (tm."functions")
      )
  )
);

DROP POLICY IF EXISTS "lead_activity_reactions_realtime_select" ON "lead_activity_reactions";
CREATE POLICY "lead_activity_reactions_realtime_select"
ON "lead_activity_reactions"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "lead_activities" la
    JOIN "leads" l
      ON l."id" = la."leadId"
    JOIN "team_members" tm
      ON tm."teamId" = l."teamId"
    JOIN "profiles" p
      ON p."id" = tm."profileId"
    WHERE la."id" = "lead_activity_reactions"."activityId"
      AND (
        p."supabaseId" = auth.uid()
        OR p."id" = auth.uid()
      )
      AND (
        tm."role" = 'manager'::"UserRole"
        OR 'SDR'::"UserFunction" = ANY (tm."functions")
        OR 'CLOSER'::"UserFunction" = ANY (tm."functions")
      )
  )
);
