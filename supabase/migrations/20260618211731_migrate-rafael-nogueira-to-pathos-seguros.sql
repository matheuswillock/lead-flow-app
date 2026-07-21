DO $$
DECLARE
  v_rafael_profile_id constant uuid := '53b0ba0f-0fc2-451c-b3ea-9c27446be10e';
  v_henrique_profile_id constant uuid := '07316970-c45f-4cc3-977a-4e0fa1d706f9';
  v_carlos_profile_id constant uuid := 'df71451b-bcd2-4602-9b7b-230b32f08b65';
  v_pathos_team_id constant uuid := 'c30e3590-04a3-4544-bf66-43228037bfc9';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_profiles"
    WHERE id = v_rafael_profile_id
  ) THEN
    RAISE NOTICE 'Skipping Rafael migration: profile % not found', v_rafael_profile_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_profiles"
    WHERE id = v_carlos_profile_id
  ) THEN
    RAISE NOTICE 'Skipping Rafael migration: profile % not found', v_carlos_profile_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_teams"
    WHERE id = v_pathos_team_id
      AND "masterId" = v_carlos_profile_id
  ) THEN
    RAISE NOTICE 'Skipping Rafael migration: team % for manager % not found', v_pathos_team_id, v_carlos_profile_id;
    RETURN;
  END IF;

  UPDATE "public"."corretor_studio_profiles"
  SET
    "managerId" = v_carlos_profile_id,
    "activeTeamId" = v_pathos_team_id,
    "updatedAt" = now()
  WHERE id IN (v_rafael_profile_id, v_henrique_profile_id);

  INSERT INTO "public"."corretor_studio_team_members"
    (
      "id",
      "teamId",
      "profileId",
      "role",
      "functions",
      "canCreateAccountUsers",
      "canManageAccountTeams",
      "canTransferAccountLeads",
      "createdAt",
      "updatedAt"
    )
  SELECT
    gen_random_uuid(),
    v_pathos_team_id,
    p.id,
    p."role",
    p."functions",
    false,
    false,
    false,
    now(),
    now()
  FROM "public"."corretor_studio_profiles" p
  WHERE p.id IN (v_rafael_profile_id, v_henrique_profile_id)
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = v_pathos_team_id
        AND tm."profileId" = p.id
    );
END $$;
