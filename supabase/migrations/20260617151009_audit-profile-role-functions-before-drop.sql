DO $$
DECLARE
  missing_memberships integer;
  missing_active_memberships integer;
BEGIN
  SELECT count(*)
    INTO missing_memberships
  FROM "public"."corretor_studio_profiles" p
  WHERE
    (p."supabaseId" IS NOT NULL OR p."isMaster" = true OR p."managerId" IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      WHERE tm."profileId" = p."id"
    );

  IF missing_memberships > 0 THEN
    RAISE EXCEPTION
      'Cannot drop profile role/functions: % relevant profiles have no TeamMember rows',
      missing_memberships;
  END IF;

  SELECT count(*)
    INTO missing_active_memberships
  FROM "public"."corretor_studio_profiles" p
  WHERE
    p."activeTeamId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      WHERE tm."profileId" = p."id"
        AND tm."teamId" = p."activeTeamId"
    );

  IF missing_active_memberships > 0 THEN
    RAISE EXCEPTION
      'Cannot drop profile role/functions: % profiles have activeTeamId without matching TeamMember',
      missing_active_memberships;
  END IF;
END $$;
