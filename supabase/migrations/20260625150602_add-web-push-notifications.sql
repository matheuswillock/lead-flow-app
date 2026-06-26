-- Add MEETING_REMINDER notification type
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'MEETING_REMINDER';

-- Add reminder sent timestamp to leads schedule
ALTER TABLE "public"."corretor_studio_leads_schedule"
  ADD COLUMN IF NOT EXISTS "reminder30MinSentAt" TIMESTAMPTZ(6);

-- Web push subscriptions per profile
CREATE TABLE IF NOT EXISTS "public"."corretor_studio_profile_web_push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_profile_web_push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_profile_web_push_subscriptions_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_profile_web_push_subscriptions_endpoint_key"
  ON "public"."corretor_studio_profile_web_push_subscriptions"("endpoint");

CREATE INDEX IF NOT EXISTS "corretor_studio_profile_web_push_subscriptions_profile_id_idx"
  ON "public"."corretor_studio_profile_web_push_subscriptions"("profileId");
