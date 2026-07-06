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

-- Políticas RLS dependem de profileId — remover antes de dropar a coluna
DROP POLICY IF EXISTS "email_credit_subscriptions_select" ON "public"."corretor_studio_email_credit_subscriptions";
DROP POLICY IF EXISTS "email_credit_subscriptions_insert" ON "public"."corretor_studio_email_credit_subscriptions";
DROP POLICY IF EXISTS "email_credit_subscriptions_update" ON "public"."corretor_studio_email_credit_subscriptions";
DROP POLICY IF EXISTS "email_credit_subscriptions_delete" ON "public"."corretor_studio_email_credit_subscriptions";
DROP POLICY IF EXISTS "email_credit_usages_select" ON "public"."corretor_studio_email_credit_usages";
DROP POLICY IF EXISTS "email_credit_usages_insert" ON "public"."corretor_studio_email_credit_usages";
DROP POLICY IF EXISTS "email_credit_usages_update" ON "public"."corretor_studio_email_credit_usages";
DROP POLICY IF EXISTS "email_credit_usages_delete" ON "public"."corretor_studio_email_credit_usages";

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

-- Recria RLS escopado por teamId (membro do time)
CREATE POLICY "email_credit_subscriptions_select"
  ON "public"."corretor_studio_email_credit_subscriptions"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" AS tm
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_email_credit_subscriptions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_subscriptions_insert"
  ON "public"."corretor_studio_email_credit_subscriptions"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" AS tm
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_email_credit_subscriptions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_subscriptions_update"
  ON "public"."corretor_studio_email_credit_subscriptions"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" AS tm
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_email_credit_subscriptions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_subscriptions_delete"
  ON "public"."corretor_studio_email_credit_subscriptions"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_team_members" AS tm
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE tm."teamId" = "corretor_studio_email_credit_subscriptions"."teamId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_usages_select"
  ON "public"."corretor_studio_email_credit_usages"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_email_credit_subscriptions" AS cs
      JOIN "public"."corretor_studio_team_members" AS tm ON tm."teamId" = cs."teamId"
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE cs."id" = "corretor_studio_email_credit_usages"."subscriptionId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_usages_insert"
  ON "public"."corretor_studio_email_credit_usages"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_email_credit_subscriptions" AS cs
      JOIN "public"."corretor_studio_team_members" AS tm ON tm."teamId" = cs."teamId"
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE cs."id" = "corretor_studio_email_credit_usages"."subscriptionId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_usages_update"
  ON "public"."corretor_studio_email_credit_usages"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_email_credit_subscriptions" AS cs
      JOIN "public"."corretor_studio_team_members" AS tm ON tm."teamId" = cs."teamId"
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE cs."id" = "corretor_studio_email_credit_usages"."subscriptionId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );

CREATE POLICY "email_credit_usages_delete"
  ON "public"."corretor_studio_email_credit_usages"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."corretor_studio_email_credit_subscriptions" AS cs
      JOIN "public"."corretor_studio_team_members" AS tm ON tm."teamId" = cs."teamId"
      JOIN "public"."corretor_studio_profiles" AS p ON p."id" = tm."profileId"
      WHERE cs."id" = "corretor_studio_email_credit_usages"."subscriptionId"
        AND (p."supabaseId" = auth.uid() OR p."id" = auth.uid())
    )
  );
