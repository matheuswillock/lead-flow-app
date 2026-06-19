DO $$
DECLARE
  v_team_id constant uuid := '7d175d9a-62ed-4c39-9eba-c381d0ddfaf7';
BEGIN
  UPDATE "public"."corretor_studio_profiles"
  SET
    "activeTeamId" = v_team_id,
    "updatedAt" = now()
  WHERE "id" IN (
    '1b1cc33f-1aea-4877-bc53-ca49d52ee764',
    '84183a6a-71f1-48b5-a6a7-4b3ccbc7e16b',
    '26b6c2d6-6377-45ac-a760-9705984ac6f8',
    '05750ae8-e9bd-4635-8988-b042b3b83c40',
    '35df9767-5413-4ddb-b360-4f3d585db38f',
    '7d20b50d-819e-4f41-82bf-898511aab581',
    '87daaaca-41f4-475e-9304-d23bb7f0085c',
    'c31d51be-0ced-418c-b353-026cb667a864'
  )
    AND EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_teams" t
      WHERE t."id" = v_team_id
        AND t."masterId" = COALESCE("corretor_studio_profiles"."managerId", "corretor_studio_profiles"."id")
    );

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
    v_team_id,
    p."id",
    p."role",
    p."functions",
    false,
    false,
    false,
    now(),
    now()
  FROM "public"."corretor_studio_profiles" p
  WHERE p."id" IN (
    '1b1cc33f-1aea-4877-bc53-ca49d52ee764',
    '84183a6a-71f1-48b5-a6a7-4b3ccbc7e16b',
    '26b6c2d6-6377-45ac-a760-9705984ac6f8',
    '05750ae8-e9bd-4635-8988-b042b3b83c40',
    '35df9767-5413-4ddb-b360-4f3d585db38f',
    '7d20b50d-819e-4f41-82bf-898511aab581',
    '87daaaca-41f4-475e-9304-d23bb7f0085c',
    'c31d51be-0ced-418c-b353-026cb667a864'
  )
    AND EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_teams" t
      WHERE t."id" = v_team_id
        AND t."masterId" = COALESCE(p."managerId", p."id")
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" tm
      WHERE tm."teamId" = v_team_id
        AND tm."profileId" = p."id"
    );
END $$;
