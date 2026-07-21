-- Add canSponsorAccounts flag to profiles (marks which masters can sponsor associate/guest accounts)
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "canSponsorAccounts" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "corretor_studio_profiles_canSponsorAccounts_idx"
  ON "public"."corretor_studio_profiles"("canSponsorAccounts");

-- Add sponsorMasterId to backoffice_adhesions (stores chosen sponsor until account creation)
ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "sponsorMasterId" uuid;
