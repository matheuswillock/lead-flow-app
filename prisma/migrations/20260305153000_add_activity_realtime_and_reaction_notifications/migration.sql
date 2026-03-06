-- Add new notification type for activity reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'ACTIVITY_REACTION'
  ) THEN
    ALTER TYPE "notification_type" ADD VALUE 'ACTIVITY_REACTION';
  END IF;
END$$;

-- Ensure lead activities tables are available in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lead_activities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "lead_activities"';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lead_activity_reactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "lead_activity_reactions"';
  END IF;
END$$;

-- Enable row-level security for realtime reads
ALTER TABLE "lead_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_activity_reactions" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE "lead_activities" TO authenticated;
GRANT SELECT ON TABLE "lead_activity_reactions" TO authenticated;

-- Ensure DELETE payload includes full row for reaction events
ALTER TABLE "lead_activity_reactions" REPLICA IDENTITY FULL;

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
    WHERE l."id" = "lead_activities"."leadId"
      AND tm."profileId" = auth.uid()
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
    WHERE la."id" = "lead_activity_reactions"."activityId"
      AND tm."profileId" = auth.uid()
      AND (
        tm."role" = 'manager'::"UserRole"
        OR 'SDR'::"UserFunction" = ANY (tm."functions")
        OR 'CLOSER'::"UserFunction" = ANY (tm."functions")
      )
  )
);
