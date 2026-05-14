-- Migration: add_crm_email_feature_hierarchy
-- Ensures products exist, adds new feature slugs (crm-wallet, email sub-features),
-- deactivates the redundant crm-crm slug, and sets parentId hierarchy
-- for CRM and Email umbrella features. Fully idempotent.

-- ─── 0. Ensure required products exist ──────────────────────────────────────

INSERT INTO "backoffice_products" ("id", "slug", "name", "type", "billingMode", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'crm',        'CRM',              'PLAN',  'RECURRING', true, NOW(), NOW()),
  (gen_random_uuid(), 'crm-lifetime','CRM Vitalício',   'PLAN',  'LIFETIME',  true, NOW(), NOW()),
  (gen_random_uuid(), 'extra-team', 'Time Adicional',   'ADDON', 'RECURRING', true, NOW(), NOW()),
  (gen_random_uuid(), 'extra-user', 'Usuário Adicional','ADDON', 'RECURRING', true, NOW(), NOW()),
  (gen_random_uuid(), 'email',      'Email',            'ADDON', 'RECURRING', true, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- ─── 1. Insert / update new features ────────────────────────────────────────

INSERT INTO "backoffice_features" ("id", "slug", "name", "accessMode", "defaultAccessLevel", "betaEnabled", "isActive", "sortOrder", "productSlug", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'crm-wallet',       'Carteira',   'PAID', 'FULL', false, true,  95,  'crm',   NOW(), NOW()),
  (gen_random_uuid(), 'email-templates',  'Templates',  'PAID', 'FULL', false, true,  110, 'email', NOW(), NOW()),
  (gen_random_uuid(), 'email-contacts',   'Contatos',   'PAID', 'FULL', false, true,  120, 'email', NOW(), NOW()),
  (gen_random_uuid(), 'email-campaigns',  'Campanhas',  'PAID', 'FULL', false, true,  130, 'email', NOW(), NOW()),
  (gen_random_uuid(), 'email-history',    'Histórico',  'PAID', 'FULL', false, true,  140, 'email', NOW(), NOW()),
  (gen_random_uuid(), 'email-analytics',  'Analytics',  'PAID', 'FULL', false, true,  150, 'email', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
  SET "name"               = EXCLUDED."name",
      "accessMode"         = EXCLUDED."accessMode",
      "defaultAccessLevel" = EXCLUDED."defaultAccessLevel",
      "sortOrder"          = EXCLUDED."sortOrder",
      "productSlug"        = EXCLUDED."productSlug",
      "isActive"           = EXCLUDED."isActive",
      "updatedAt"          = NOW();

-- ─── 2. Ensure existing features have correct productSlug ────────────────────

UPDATE "backoffice_features" SET "productSlug" = 'crm',        "updatedAt" = NOW() WHERE "slug" IN ('crm', 'crm-dashboard', 'crm-calendar', 'crm-performance', 'crm-simulator', 'crm-time', 'crm-wallet');
UPDATE "backoffice_features" SET "productSlug" = 'extra-team', "updatedAt" = NOW() WHERE "slug" = 'crm-time-manage-teams';
UPDATE "backoffice_features" SET "productSlug" = 'extra-user', "updatedAt" = NOW() WHERE "slug" = 'crm-time-manage-users';
UPDATE "backoffice_features" SET "productSlug" = 'email',      "updatedAt" = NOW() WHERE "slug" IN ('email', 'email-templates', 'email-contacts', 'email-campaigns', 'email-history', 'email-analytics');

-- ─── 3. Deactivate redundant slug crm-crm ───────────────────────────────────

UPDATE "backoffice_features" SET "isActive" = false, "updatedAt" = NOW() WHERE "slug" = 'crm-crm';

-- ─── 4. Set parentId hierarchy (idempotent) ──────────────────────────────────

-- CRM children → parent = crm
UPDATE "backoffice_features"
SET "parentId"  = (SELECT "id" FROM "backoffice_features" WHERE "slug" = 'crm'),
    "updatedAt" = NOW()
WHERE "slug" IN (
  'crm-dashboard', 'crm-calendar', 'crm-performance',
  'crm-simulator', 'crm-time', 'crm-time-manage-teams',
  'crm-time-manage-users', 'crm-wallet'
)
AND ("parentId" IS DISTINCT FROM (SELECT "id" FROM "backoffice_features" WHERE "slug" = 'crm'));

-- Email children → parent = email
UPDATE "backoffice_features"
SET "parentId"  = (SELECT "id" FROM "backoffice_features" WHERE "slug" = 'email'),
    "updatedAt" = NOW()
WHERE "slug" IN (
  'email-templates', 'email-contacts', 'email-campaigns',
  'email-history', 'email-analytics'
)
AND ("parentId" IS DISTINCT FROM (SELECT "id" FROM "backoffice_features" WHERE "slug" = 'email'));
