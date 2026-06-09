-- Rename backoffice_user_subscriptions → backoffice_user_product_subscriptions.
-- BackofficeUserSubscription is a product-entitlement record (profileId+productId),
-- distinct from the main ProfileSubscription. Renaming for clarity.

ALTER TABLE IF EXISTS "public"."backoffice_user_subscriptions"
  RENAME TO "backoffice_user_product_subscriptions";

-- Rename primary key constraint (also renames the underlying index)
ALTER TABLE IF EXISTS "public"."backoffice_user_product_subscriptions"
  RENAME CONSTRAINT "backoffice_user_subscriptions_pkey"
  TO "backoffice_user_product_subscriptions_pkey";

-- Rename unique index (created as index, not constraint, in baseline migration)
ALTER INDEX IF EXISTS "backoffice_user_subscriptions_profile_id_product_id_key"
  RENAME TO "backoffice_user_product_subscriptions_profile_id_product_id_key";

-- Rename regular indexes
ALTER INDEX IF EXISTS "backoffice_user_subscriptions_adhesionId_idx"
  RENAME TO "backoffice_user_product_subscriptions_adhesionId_idx";

ALTER INDEX IF EXISTS "backoffice_user_subscriptions_productId_idx"
  RENAME TO "backoffice_user_product_subscriptions_productId_idx";

ALTER INDEX IF EXISTS "backoffice_user_subscriptions_profileId_status_idx"
  RENAME TO "backoffice_user_product_subscriptions_profileId_status_idx";
