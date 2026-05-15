-- Migration generated from database diff to prisma/schema.prisma

-- Deduplicate schedules by lead, keeping the most recent one.
WITH ranked_schedules AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "leadId"
      ORDER BY "date" DESC, "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS row_num
  FROM "leads_schedule"
)
DELETE FROM "leads_schedule" schedule
USING ranked_schedules ranked
WHERE schedule.id = ranked.id
  AND ranked.row_num > 1;

-- DropIndex
DROP INDEX IF EXISTS "leads_schedule_leadId_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "leads_schedule_leadId_key" ON "leads_schedule"("leadId");
