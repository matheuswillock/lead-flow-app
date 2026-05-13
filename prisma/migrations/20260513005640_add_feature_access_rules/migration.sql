-- Migration generated from database diff to prisma/schema.prisma

-- CreateEnum
CREATE TYPE "backoffice_access_principal" AS ENUM ('MASTER', 'MANAGER', 'BACKOFFICE', 'OPERATOR', 'SDR', 'CLOSER', 'CAN_MANAGE_TEAMS', 'CAN_CREATE_USERS');

-- AlterEnum
BEGIN;
CREATE TYPE "backoffice_feature_access_level_new" AS ENUM ('NONE', 'READ', 'FULL');
ALTER TABLE "public"."backoffice_feature_grants" ALTER COLUMN "accessLevel" DROP DEFAULT;
ALTER TABLE "public"."backoffice_features" ALTER COLUMN "defaultAccessLevel" DROP DEFAULT;
ALTER TABLE "backoffice_features" ALTER COLUMN "defaultAccessLevel" TYPE "backoffice_feature_access_level_new" USING ("defaultAccessLevel"::text::"backoffice_feature_access_level_new");
ALTER TABLE "backoffice_feature_grants" ALTER COLUMN "accessLevel" TYPE "backoffice_feature_access_level_new" USING ("accessLevel"::text::"backoffice_feature_access_level_new");
ALTER TYPE "backoffice_feature_access_level" RENAME TO "backoffice_feature_access_level_old";
ALTER TYPE "backoffice_feature_access_level_new" RENAME TO "backoffice_feature_access_level";
DROP TYPE "public"."backoffice_feature_access_level_old";
ALTER TABLE "backoffice_feature_grants" ALTER COLUMN "accessLevel" SET DEFAULT 'FULL';
ALTER TABLE "backoffice_features" ALTER COLUMN "defaultAccessLevel" SET DEFAULT 'FULL';
COMMIT;

-- AlterEnum
ALTER TYPE "backoffice_feature_access_mode" ADD VALUE 'ADDON';

-- CreateTable
CREATE TABLE "backoffice_feature_access_rules" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "featureId" TEXT NOT NULL,
    "principal" "backoffice_access_principal" NOT NULL,
    "accessLevel" "backoffice_feature_access_level" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backoffice_feature_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backoffice_feature_access_rules_feature_id_idx" ON "backoffice_feature_access_rules"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_feature_access_rules_feature_principal_key" ON "backoffice_feature_access_rules"("featureId", "principal");

-- AddForeignKey
ALTER TABLE "backoffice_feature_access_rules" ADD CONSTRAINT "backoffice_feature_access_rules_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "backoffice_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
