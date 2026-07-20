-- Backfill: Erick Serafim → Member PRO + usuários ilimitados
-- Profile: f94a3014-2ada-4aea-958e-49294fe7dc16
-- Email: erickserafimm@gmail.com

DO $$
DECLARE
  v_profile_id uuid := 'f94a3014-2ada-4aea-958e-49294fe7dc16';
  v_member_pro_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "corretor_studio_profiles"
    WHERE "id" = v_profile_id
      AND lower("email") = lower('erickserafimm@gmail.com')
  ) THEN
    RAISE NOTICE 'Profile alvo não encontrado ou email divergente — skip';
    RETURN;
  END IF;

  SELECT "id" INTO v_member_pro_id
  FROM "profile_user_types"
  WHERE "slug" = 'member_pro';

  IF v_member_pro_id IS NULL THEN
    RAISE EXCEPTION 'profile_user_types.slug=member_pro não encontrado';
  END IF;

  INSERT INTO "profile_user_type_assignments"
    ("id", "profileId", "userTypeId", "accessExpiresAt", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), v_profile_id, v_member_pro_id, now() + interval '365 days', now(), now())
  ON CONFLICT ("profileId") DO UPDATE SET
    "userTypeId" = EXCLUDED."userTypeId",
    "accessExpiresAt" = EXCLUDED."accessExpiresAt",
    "updatedAt" = now();

  UPDATE "corretor_studio_profiles"
  SET
    "hasUnlimitedUsers" = true,
    "hasPermanentSubscription" = false,
    "updatedAt" = now()
  WHERE "id" = v_profile_id;
END $$;
