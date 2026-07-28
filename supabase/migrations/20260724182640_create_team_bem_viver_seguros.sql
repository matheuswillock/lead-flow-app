-- Reconciled data migration (originally applied out-of-band directly against
-- production — see incident investigated 2026-07-24). Guarded so it stays a
-- true no-op on any environment where the referenced master profile doesn't
-- exist (every fresh local `db:migrate:reset:local`) instead of failing the
-- whole replay with a FK violation, while still applying normally wherever
-- the profile is present (production, where it already ran).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM corretor_studio_profiles WHERE id = '0c96a57e-6cc1-400f-bf3a-5740b699ac21')
     AND NOT EXISTS (
       SELECT 1 FROM corretor_studio_teams
       WHERE "masterId" = '0c96a57e-6cc1-400f-bf3a-5740b699ac21' AND name = 'Bem Viver Seguros'
     )
  THEN
    INSERT INTO corretor_studio_teams (id, name, "masterId", "isDefault", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Bem Viver Seguros', '0c96a57e-6cc1-400f-bf3a-5740b699ac21', false, now(), now());
  END IF;
END $$;
