-- Estágio 7 (D2 / D7): enum de ciclo + SubscriptionChangeLog.

DO $$ BEGIN
  CREATE TYPE "public"."subscription_cycle" AS ENUM (
    'MONTHLY',
    'QUARTERLY',
    'SEMIANNUALLY',
    'YEARLY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Normaliza strings legadas em Profile / ProfileSubscription (best-effort).
UPDATE "public"."corretor_studio_profiles"
SET "subscriptionCycle" = UPPER("subscriptionCycle")
WHERE "subscriptionCycle" IS NOT NULL
  AND "subscriptionCycle" <> UPPER("subscriptionCycle");

UPDATE "public"."corretor_studio_profiles"
SET "subscriptionCycle" = CASE
  WHEN LOWER("subscriptionCycle") IN ('monthly', 'month') THEN 'MONTHLY'
  WHEN LOWER("subscriptionCycle") IN ('quarterly', 'quarter') THEN 'QUARTERLY'
  WHEN LOWER("subscriptionCycle") IN ('semiannually', 'semiannual', 'semi_annual') THEN 'SEMIANNUALLY'
  WHEN LOWER("subscriptionCycle") IN ('yearly', 'annual', 'annually') THEN 'YEARLY'
  ELSE "subscriptionCycle"
END
WHERE "subscriptionCycle" IS NOT NULL;

UPDATE "public"."corretor_studio_profile_subscriptions"
SET "subscriptionCycle" = CASE
  WHEN LOWER("subscriptionCycle") IN ('monthly', 'month') THEN 'MONTHLY'
  WHEN LOWER("subscriptionCycle") IN ('quarterly', 'quarter') THEN 'QUARTERLY'
  WHEN LOWER("subscriptionCycle") IN ('semiannually', 'semiannual', 'semi_annual') THEN 'SEMIANNUALLY'
  WHEN LOWER("subscriptionCycle") IN ('yearly', 'annual', 'annually') THEN 'YEARLY'
  ELSE UPPER("subscriptionCycle")
END
WHERE "subscriptionCycle" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_subscription_change_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE CASCADE,
  "source" TEXT NOT NULL,
  "actorProfileId" UUID NULL REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL,
  "changeType" TEXT NOT NULL,
  "before" JSONB NULL,
  "after" JSONB NULL,
  "metadata" JSONB NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_change_logs_profile_id_idx"
  ON "public"."corretor_studio_subscription_change_logs" ("profileId");

CREATE INDEX IF NOT EXISTS "subscription_change_logs_created_at_idx"
  ON "public"."corretor_studio_subscription_change_logs" ("createdAt");

ALTER TABLE "public"."corretor_studio_subscription_change_logs" ENABLE ROW LEVEL SECURITY;
