-- Profile.multiskillEnabled: master opt-in para receber transferências MultiSkill
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "multiskillEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "multiskillEnabled" BOOLEAN NOT NULL DEFAULT false;
