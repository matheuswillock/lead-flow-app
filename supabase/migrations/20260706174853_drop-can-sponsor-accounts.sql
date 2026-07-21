-- Remove coluna legada canSponsorAccounts (fonte única: backoffice_authorized_sponsors)

DROP INDEX IF EXISTS "corretor_studio_profiles_canSponsorAccounts_idx";

ALTER TABLE "public"."corretor_studio_profiles"
  DROP COLUMN IF EXISTS "canSponsorAccounts";
