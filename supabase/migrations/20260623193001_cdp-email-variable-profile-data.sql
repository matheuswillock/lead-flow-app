-- CDP + E-mail: variáveis ligadas a campos CDP e profileData materializado

DO $$ BEGIN
  CREATE TYPE "public"."EmailVariableValueSource" AS ENUM ('STATIC', 'CDP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."email_team_variables"
  ADD COLUMN IF NOT EXISTS "valueSource" "public"."EmailVariableValueSource" NOT NULL DEFAULT 'STATIC',
  ADD COLUMN IF NOT EXISTS "cdpFieldKey" TEXT;

ALTER TABLE "public"."corretor_studio_cdp_profiles"
  ADD COLUMN IF NOT EXISTS "profileData" JSONB;

CREATE INDEX IF NOT EXISTS "corretor_studio_cdp_profiles_team_profile_data_idx"
  ON "public"."corretor_studio_cdp_profiles" ("teamId")
  WHERE "profileData" IS NOT NULL;
