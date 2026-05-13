-- Migration generated from database diff to prisma/schema.prisma

-- AlterTable
ALTER TABLE "leads_schedule" ADD COLUMN     "noShowCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill no-show count on the latest schedule per lead
WITH no_show_counts AS (
  SELECT
    la."leadId" AS lead_id,
    COUNT(*)::INTEGER AS no_show_count
  FROM "lead_activities" la
  WHERE la."type" = 'status_change'
    AND COALESCE(la."payload" ->> 'to', '') = 'no_show'
  GROUP BY la."leadId"
),
latest_schedule AS (
  SELECT DISTINCT ON (ls."leadId")
    ls."id",
    ls."leadId"
  FROM "leads_schedule" ls
  ORDER BY ls."leadId", ls."date" DESC, ls."createdAt" DESC
)
UPDATE "leads_schedule" ls
SET "noShowCount" = nsc.no_show_count
FROM no_show_counts nsc
JOIN latest_schedule lss ON lss."leadId" = nsc.lead_id
WHERE ls."id" = lss."id";

-- Trigger function to increment no-show count on real status transitions to no_show
CREATE OR REPLACE FUNCTION public.increment_latest_schedule_no_show_count()
RETURNS trigger AS $$
BEGIN
  IF NEW."status"::text = 'no_show'
     AND OLD."status"::text IS DISTINCT FROM 'no_show' THEN
    UPDATE "leads_schedule" ls
    SET "noShowCount" = COALESCE(ls."noShowCount", 0) + 1,
        "updatedAt" = NOW()
    WHERE ls."id" = (
      SELECT s."id"
      FROM "leads_schedule" s
      WHERE s."leadId" = NEW."id"
      ORDER BY s."date" DESC, s."createdAt" DESC
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_latest_schedule_no_show_count ON "leads";

CREATE TRIGGER trg_increment_latest_schedule_no_show_count
AFTER UPDATE OF "status" ON "leads"
FOR EACH ROW
WHEN (
  NEW."status"::text = 'no_show'
  AND OLD."status"::text IS DISTINCT FROM 'no_show'
)
EXECUTE FUNCTION public.increment_latest_schedule_no_show_count();
