INSERT INTO "public"."corretor_studio_team_members"
  ("id", "teamId", "profileId", "role", "functions", "canCreateAccountUsers", "canManageAccountTeams", "canTransferAccountLeads", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p."activeTeamId",
  p."id",
  p."role",
  p."functions",
  CASE WHEN p."role" = 'manager' THEN p."canCreateAccountUsers" ELSE false END,
  CASE WHEN p."role" = 'manager' THEN p."canManageAccountTeams" ELSE false END,
  CASE WHEN p."role" IN ('manager', 'backoffice') THEN p."canTransferAccountLeads" ELSE false END,
  now(),
  now()
FROM "public"."corretor_studio_profiles" p
WHERE p."activeTeamId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."backoffice_users" bu
    WHERE bu."profileId" = p."id"
  )
  AND EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_teams" t
    WHERE t."id" = p."activeTeamId"
      AND t."masterId" = COALESCE(p."managerId", p."id")
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_team_members" tm
    WHERE tm."profileId" = p."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_team_members" existing
    WHERE existing."teamId" = p."activeTeamId"
      AND existing."profileId" = p."id"
  );

WITH candidate_profiles AS (
  SELECT
    p."id" AS "profileId",
    p."role",
    p."functions",
    p."canCreateAccountUsers",
    p."canManageAccountTeams",
    p."canTransferAccountLeads",
    (array_agg(t."id" ORDER BY t."createdAt" ASC, t."id" ASC))[1] AS "teamId",
    COUNT(t."id") AS "teamCount"
  FROM "public"."corretor_studio_profiles" p
  JOIN "public"."corretor_studio_teams" t
    ON t."masterId" = COALESCE(p."managerId", p."id")
  WHERE p."activeTeamId" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."backoffice_users" bu
      WHERE bu."profileId" = p."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      WHERE tm."profileId" = p."id"
    )
  GROUP BY
    p."id",
    p."role",
    p."functions",
    p."canCreateAccountUsers",
    p."canManageAccountTeams",
    p."canTransferAccountLeads"
)
INSERT INTO "public"."corretor_studio_team_members"
  ("id", "teamId", "profileId", "role", "functions", "canCreateAccountUsers", "canManageAccountTeams", "canTransferAccountLeads", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  cp."teamId",
  cp."profileId",
  cp."role",
  cp."functions",
  CASE WHEN cp."role" = 'manager' THEN cp."canCreateAccountUsers" ELSE false END,
  CASE WHEN cp."role" = 'manager' THEN cp."canManageAccountTeams" ELSE false END,
  CASE WHEN cp."role" IN ('manager', 'backoffice') THEN cp."canTransferAccountLeads" ELSE false END,
  now(),
  now()
FROM candidate_profiles cp
WHERE cp."teamCount" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_team_members" existing
    WHERE existing."teamId" = cp."teamId"
      AND existing."profileId" = cp."profileId"
  );
