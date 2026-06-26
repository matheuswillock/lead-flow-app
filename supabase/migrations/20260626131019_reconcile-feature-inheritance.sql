-- Reconcile inheritParentSettings and beta flags for child features.
-- Idempotent: safe to re-run on local mirrors and production.

UPDATE "public"."backoffice_features"
SET
  "inheritParentSettings" = true,
  "betaEnabled" = false,
  "updatedAt" = now()
WHERE "slug" IN (
  'crm-dashboard',
  'crm-calendar',
  'crm-performance',
  'crm-simulator',
  'crm-time',
  'crm-time-manage-teams',
  'crm-time-manage-users',
  'crm-wallet',
  'email-templates',
  'email-contacts',
  'email-campaigns',
  'email-history',
  'email-analytics',
  'whatsapp-settings'
)
AND "parentId" IS NOT NULL;

-- Children with own access rules must not inherit parent settings.
UPDATE "public"."backoffice_features"
SET
  "inheritParentSettings" = false,
  "updatedAt" = now()
WHERE "slug" IN (
  'crm-lead-transfers',
  'email-settings',
  'whatsapp-auto-responses'
);

-- Safety: inheriting children must never be beta roots.
UPDATE "public"."backoffice_features"
SET
  "betaEnabled" = false,
  "updatedAt" = now()
WHERE "inheritParentSettings" = true
  AND "betaEnabled" = true;

-- Deactivate orphan beta grants on inheriting children.
UPDATE "public"."backoffice_feature_grants" g
SET
  "isActive" = false,
  "updatedAt" = now()
FROM "public"."backoffice_features" f
WHERE g."featureId" = f.id
  AND g."grantType" = 'BETA'
  AND g."isActive" = true
  AND f."inheritParentSettings" = true;
