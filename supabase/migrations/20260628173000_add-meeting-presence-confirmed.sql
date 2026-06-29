ALTER TABLE "public"."corretor_studio_leads"
  ADD COLUMN IF NOT EXISTS "meetingPresenceConfirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."corretor_studio_leads"
  ADD COLUMN IF NOT EXISTS "meetingPresenceConfirmedAt" TIMESTAMPTZ(6);
