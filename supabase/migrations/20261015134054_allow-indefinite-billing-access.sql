-- NULL expiresAt is an explicit, operator-revocable indefinite access grant.
-- Payment status, subscriptions and Asaas resources remain unchanged.
ALTER TABLE IF EXISTS "public"."billing_access_graces"
  ALTER COLUMN "expiresAt" DROP NOT NULL;
