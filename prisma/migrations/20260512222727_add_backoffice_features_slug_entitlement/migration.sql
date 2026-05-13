-- Migration generated from database diff to prisma/schema.prisma

-- CreateEnum
CREATE TYPE "backoffice_feature_access_mode" AS ENUM ('PUBLIC', 'PAID');

-- CreateEnum
CREATE TYPE "backoffice_feature_access_level" AS ENUM ('NONE', 'READ', 'FULL');

-- CreateEnum
CREATE TYPE "backoffice_feature_grant_type" AS ENUM ('BETA');

-- CreateTable
CREATE TABLE "backoffice_features" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "productSlug" TEXT,
    "accessMode" "backoffice_feature_access_mode" NOT NULL DEFAULT 'PUBLIC',
    "defaultAccessLevel" "backoffice_feature_access_level" NOT NULL DEFAULT 'FULL',
    "betaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backoffice_feature_grants" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "grantType" "backoffice_feature_grant_type" NOT NULL DEFAULT 'BETA',
    "accessLevel" "backoffice_feature_access_level" NOT NULL DEFAULT 'FULL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_feature_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_features_slug_key" ON "backoffice_features"("slug");

-- CreateIndex
CREATE INDEX "backoffice_features_parent_id_idx" ON "backoffice_features"("parentId");

-- CreateIndex
CREATE INDEX "backoffice_features_product_slug_idx" ON "backoffice_features"("productSlug");

-- CreateIndex
CREATE INDEX "backoffice_features_active_sort_idx" ON "backoffice_features"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "backoffice_feature_grants_profile_grant_type_active_idx" ON "backoffice_feature_grants"("profileId", "grantType", "isActive");

-- CreateIndex
CREATE INDEX "backoffice_feature_grants_feature_active_idx" ON "backoffice_feature_grants"("featureId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_feature_grants_feature_profile_grant_type_key" ON "backoffice_feature_grants"("featureId", "profileId", "grantType");

-- AddForeignKey
ALTER TABLE "backoffice_features" ADD CONSTRAINT "backoffice_features_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "backoffice_features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_features" ADD CONSTRAINT "backoffice_features_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "backoffice_products"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_feature_grants" ADD CONSTRAINT "backoffice_feature_grants_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "backoffice_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backoffice_feature_grants" ADD CONSTRAINT "backoffice_feature_grants_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default features (idempotent)
INSERT INTO "backoffice_features"
  ("id", "slug", "name", "description", "parentId", "productSlug", "accessMode", "defaultAccessLevel", "betaEnabled", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'crm', 'CRM', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-dashboard', 'Dashboard', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-crm', 'CRM', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-calendar', 'Calendário', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 40, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-performance', 'Performance', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 50, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-simulator', 'Simulador de Planos', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 60, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-time', 'Time', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 70, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-time-manage-teams', 'Gerenciar Times', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 80, NOW(), NOW()),
  (gen_random_uuid()::text, 'crm-time-manage-users', 'Gerenciar Usuários', NULL, NULL, NULL, 'PAID', 'FULL', false, true, 90, NOW(), NOW()),
  (gen_random_uuid()::text, 'email', 'Email', NULL, NULL, NULL, 'PAID', 'FULL', true, true, 100, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "productSlug" = EXCLUDED."productSlug",
  "accessMode" = EXCLUDED."accessMode",
  "defaultAccessLevel" = EXCLUDED."defaultAccessLevel",
  "betaEnabled" = EXCLUDED."betaEnabled",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();
