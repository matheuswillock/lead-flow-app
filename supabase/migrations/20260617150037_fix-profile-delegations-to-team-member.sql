UPDATE "public"."corretor_studio_team_members" tm
SET
  "canCreateAccountUsers" =
    CASE
      WHEN tm."role" = 'manager' THEN p."canCreateAccountUsers"
      ELSE false
    END,
  "canManageAccountTeams" =
    CASE
      WHEN tm."role" = 'manager' THEN p."canManageAccountTeams"
      ELSE false
    END,
  "canTransferAccountLeads" =
    CASE
      WHEN tm."role" IN ('manager', 'backoffice') THEN p."canTransferAccountLeads"
      ELSE false
    END
FROM "public"."corretor_studio_profiles" p
WHERE tm."profileId" = p."id";
