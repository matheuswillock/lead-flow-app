-- Sync dispatchCount with actual dispatch records (idempotent)
UPDATE "public"."corretor_studio_email_campaigns" c
SET "dispatchCount" = sub.cnt
FROM (
  SELECT "campaignId", COUNT(*)::int AS cnt
  FROM "public"."corretor_studio_email_campaign_dispatches"
  GROUP BY "campaignId"
) sub
WHERE c."id" = sub."campaignId"
  AND c."dispatchCount" < sub.cnt;
