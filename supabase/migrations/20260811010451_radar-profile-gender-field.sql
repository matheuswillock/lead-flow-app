-- F1: gender + genderSource em RadarProfile (DA12)

ALTER TABLE "public"."corretor_studio_radar_profiles"
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "genderSource" TEXT;

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_profiles_teamId_gender_idx"
  ON "public"."corretor_studio_radar_profiles"("teamId", "gender");
