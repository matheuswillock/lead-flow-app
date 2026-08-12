-- Add charge_during_beta to backoffice_features (BackofficeFeature.chargeDuringBeta)
-- Physical table/column from prisma @@map / @map — never Prisma model names in SQL.

ALTER TABLE "public"."backoffice_features"
  ADD COLUMN IF NOT EXISTS "charge_during_beta" boolean NOT NULL DEFAULT false;
