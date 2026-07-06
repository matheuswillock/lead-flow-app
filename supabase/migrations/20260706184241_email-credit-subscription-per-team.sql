-- Email credit subscription scoped per Team (D1/M1)
-- Idempotent migration: profileId -> teamId

ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
  ADD COLUMN IF NOT EXISTS "teamId" UUID;

-- Realoca assinatura existente para o Time ativo do master (M1)
UPDATE "public"."corretor_studio_email_credit_subscriptions" AS ecs
SET "teamId" = COALESCE(
  (
    SELECT p."activeTeamId"
    FROM "public"."corretor_studio_profiles" AS p
    WHERE p."id" = ecs."profileId"
      AND p."activeTeamId" IS NOT NULL
  ),
  (
    SELECT t."id"
    FROM "public"."corretor_studio_teams" AS t
    WHERE t."masterId" = ecs."profileId"
    ORDER BY t."isDefault" DESC, t."createdAt" ASC
    LIMIT 1
  )
)
WHERE ecs."teamId" IS NULL;

-- Remove assinaturas órfãs sem time resolvível (se houver)
DELETE FROM "public"."corretor_studio_email_credit_subscriptions"
WHERE "teamId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'corretor_studio_email_credit_subscriptions'
      AND column_name = 'profileId'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
      DROP CONSTRAINT IF EXISTS "corretor_studio_email_credit_subscriptions_profileId_fkey";

    DROP INDEX IF EXISTS "corretor_studio_email_credit_subscriptions_profileId_key";

    ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
      DROP COLUMN IF EXISTS "profileId";
  END IF;
END $$;

ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
  ALTER COLUMN "teamId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_credit_subscriptions_teamId_key"
  ON "public"."corretor_studio_email_credit_subscriptions" ("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'corretor_studio_email_credit_subscriptions_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
      ADD CONSTRAINT "corretor_studio_email_credit_subscriptions_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
