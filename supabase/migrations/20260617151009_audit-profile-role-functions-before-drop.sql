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
    AND p."id" NOT IN (
      '5de7227f-07e0-400c-af54-2b88c764c28b',
      '72d64455-d7df-44e0-a7a0-9b8eada7eba3',
      'cf0f1c1c-e470-47b6-a34d-439012931643',
      '60bce55e-380e-4ff6-b3de-60146e187284',
      'b6e058f5-cd15-4aff-aece-79c104d5f127',
      '885da880-273c-4f77-8c31-184215e9ce2d',
      '9a09e391-dba9-48dc-a391-5cc8a8319ade',
      'd538a1f7-7bbe-4183-b303-cc164708a740',
      'c46898df-7135-4d06-8abe-c219fa7467e2',
      '492deb28-5593-4deb-b508-4fdeb3f8aba8',
      '53b0ba0f-0fc2-451c-b3ea-9c27446be10e',
      'a199bce6-bc6d-4a91-8ce4-560f868071d8'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."backoffice_users" bu
      WHERE bu."profileId" = p."id"
    )
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
    AND p."id" NOT IN (
      '53b0ba0f-0fc2-451c-b3ea-9c27446be10e'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."backoffice_users" bu
      WHERE bu."profileId" = p."id"
    )
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
