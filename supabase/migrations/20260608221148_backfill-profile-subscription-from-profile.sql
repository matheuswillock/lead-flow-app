-- Backfill ProfileSubscription from Profile legacy subscription fields.
-- Idempotent: INSERT ... ON CONFLICT DO UPDATE.
-- Only copies rows where at least one subscription field is non-null on Profile.
-- Does NOT touch Profile — legacy columns remain intact until drop migration.

INSERT INTO "public"."corretor_studio_profile_subscriptions" (
  "profileId",
  "asaasCustomerId",
  "asaasSubscriptionId",
  "subscriptionStatus",
  "subscriptionPlan",
  "subscriptionStartDate",
  "subscriptionEndDate",
  "trialEndDate",
  "subscriptionNextDueDate",
  "subscriptionCycle",
  "hasPermanentSubscription",
  "createdAt",
  "updatedAt"
)
SELECT
  p."id"                        AS "profileId",
  p."asaasCustomerId",
  p."asaasSubscriptionId",
  p."subscriptionStatus",
  p."subscriptionPlan",
  p."subscriptionStartDate",
  p."subscriptionEndDate",
  p."trialEndDate",
  p."subscriptionNextDueDate",
  p."subscriptionCycle",
  p."hasPermanentSubscription",
  NOW()                         AS "createdAt",
  NOW()                         AS "updatedAt"
FROM "public"."corretor_studio_profiles" p
WHERE
  p."isMaster" = TRUE
  AND (
    p."asaasCustomerId"        IS NOT NULL
    OR p."asaasSubscriptionId" IS NOT NULL
    OR p."subscriptionStatus"  IS NOT NULL
    OR p."subscriptionPlan"    IS NOT NULL
    OR p."subscriptionStartDate" IS NOT NULL
    OR p."trialEndDate"        IS NOT NULL
    OR p."hasPermanentSubscription" = TRUE
  )
ON CONFLICT ("profileId") DO UPDATE SET
  "asaasCustomerId"          = COALESCE(EXCLUDED."asaasCustomerId",         "corretor_studio_profile_subscriptions"."asaasCustomerId"),
  "asaasSubscriptionId"      = COALESCE(EXCLUDED."asaasSubscriptionId",     "corretor_studio_profile_subscriptions"."asaasSubscriptionId"),
  "subscriptionStatus"       = COALESCE(EXCLUDED."subscriptionStatus",      "corretor_studio_profile_subscriptions"."subscriptionStatus"),
  "subscriptionPlan"         = COALESCE(EXCLUDED."subscriptionPlan",        "corretor_studio_profile_subscriptions"."subscriptionPlan"),
  "subscriptionStartDate"    = COALESCE(EXCLUDED."subscriptionStartDate",   "corretor_studio_profile_subscriptions"."subscriptionStartDate"),
  "subscriptionEndDate"      = COALESCE(EXCLUDED."subscriptionEndDate",     "corretor_studio_profile_subscriptions"."subscriptionEndDate"),
  "trialEndDate"             = COALESCE(EXCLUDED."trialEndDate",            "corretor_studio_profile_subscriptions"."trialEndDate"),
  "subscriptionNextDueDate"  = COALESCE(EXCLUDED."subscriptionNextDueDate", "corretor_studio_profile_subscriptions"."subscriptionNextDueDate"),
  "subscriptionCycle"        = COALESCE(EXCLUDED."subscriptionCycle",       "corretor_studio_profile_subscriptions"."subscriptionCycle"),
  "hasPermanentSubscription" = EXCLUDED."hasPermanentSubscription" OR "corretor_studio_profile_subscriptions"."hasPermanentSubscription",
  "updatedAt"                = NOW();
