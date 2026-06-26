-- Web push consent audit per profile

DO $$ BEGIN
  CREATE TYPE public.web_push_consent_status AS ENUM ('accepted', 'declined', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_profile_web_push_consents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "status" public.web_push_consent_status NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMPTZ(6),
  "declinedAt" TIMESTAMPTZ(6),
  "dismissedAt" TIMESTAMPTZ(6),
  "source" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_profile_web_push_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_profile_web_push_consents_profileId_key" UNIQUE ("profileId"),
  CONSTRAINT "corretor_studio_profile_web_push_consents_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_profile_web_push_consents_profile_id_idx"
  ON "public"."corretor_studio_profile_web_push_consents"("profileId");
