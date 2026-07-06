-- Backfill Team.isDefault: exatamente um time padrão por master (o mais antigo por createdAt)

UPDATE "public"."corretor_studio_teams"
SET "isDefault" = false;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "masterId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "public"."corretor_studio_teams"
)
UPDATE "public"."corretor_studio_teams" AS t
SET "isDefault" = true
FROM ranked AS r
WHERE t.id = r.id
  AND r.rn = 1;
