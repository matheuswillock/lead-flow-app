-- Backfill masters that have an active YEARLY subscription (previous billing
-- rule treated corretor_studio_profile_subscriptions.subscriptionCycle = 'YEARLY'
-- within its start/end window as unlimited; runtime now relies solely on the
-- persisted hasUnlimitedUsers flag).
UPDATE "public"."corretor_studio_profiles" p
SET "hasUnlimitedUsers" = true
WHERE p."hasUnlimitedUsers" = false
  AND EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_profile_subscriptions" ps
    WHERE ps."profileId" = p.id
      AND ps."subscriptionCycle" = 'YEARLY'
      AND (ps."subscriptionStatus" IS NULL OR ps."subscriptionStatus" = 'active')
      AND (ps."subscriptionStartDate" IS NULL OR ps."subscriptionStartDate" <= now())
      AND (ps."subscriptionEndDate" IS NULL OR ps."subscriptionEndDate" >= now())
  );
