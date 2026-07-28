-- Reconciled data migration (originally applied out-of-band directly against
-- production — see incident investigated 2026-07-24). Guarded so it stays a
-- true no-op on any environment where the referenced team/profile don't
-- exist (every fresh local `db:migrate:reset:local`) instead of failing the
-- whole replay with a FK violation, while still applying normally wherever
-- both are present (production, where it already ran).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM corretor_studio_teams WHERE id = '7f321ad6-d894-48f3-89c2-06e5506f0465')
     AND EXISTS (SELECT 1 FROM corretor_studio_profiles WHERE id = '405711fa-335d-4b7f-a88a-fc3b9adad504')
     AND NOT EXISTS (
       SELECT 1 FROM corretor_studio_team_members
       WHERE "teamId" = '7f321ad6-d894-48f3-89c2-06e5506f0465' AND "profileId" = '405711fa-335d-4b7f-a88a-fc3b9adad504'
     )
  THEN
    INSERT INTO corretor_studio_team_members (id, "teamId", "profileId", role, functions, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), '7f321ad6-d894-48f3-89c2-06e5506f0465', '405711fa-335d-4b7f-a88a-fc3b9adad504', 'manager', ARRAY[]::"UserFunction"[], now(), now());
  END IF;
END $$;
