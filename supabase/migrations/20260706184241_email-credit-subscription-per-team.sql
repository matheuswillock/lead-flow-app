-- Email credit subscription scoped per Team (D1/M1)
-- Idempotent migration: profileId -> teamId

ALTER TABLE "public"."corretor_studio_email_credit_subscriptions"
  ADD COLUMN IF NOT EXISTS "teamId" UUID;

-- Realoca assinatura existente para o Time ativo do master (M1)
-- Resolve o master da conta (membro → team.masterId; senão o próprio profileId)
UPDATE "public"."corretor_studio_email_credit_subscriptions" AS ecs
SET "teamId" = COALESCE(
  (
    SELECT m."activeTeamId"
    FROM "public"."corretor_studio_profiles" AS m
    WHERE m."id" = COALESCE(
      (
        SELECT t."masterId"
        FROM "public"."corretor_studio_team_members" AS tm
        JOIN "public"."corretor_studio_teams" AS t ON t."id" = tm."teamId"
        WHERE tm."profileId" = ecs."profileId"
        ORDER BY tm."createdAt" ASC
        LIMIT 1
      ),
      ecs."profileId"
    )
      AND m."activeTeamId" IS NOT NULL
  ),
  (
    SELECT t."id"
    FROM "public"."corretor_studio_teams" AS t
    WHERE t."masterId" = COALESCE(
      (
        SELECT t2."masterId"
        FROM "public"."corretor_studio_team_members" AS tm
        JOIN "public"."corretor_studio_teams" AS t2 ON t2."id" = tm."teamId"
        WHERE tm."profileId" = ecs."profileId"
        ORDER BY tm."createdAt" ASC
        LIMIT 1
      ),
      ecs."profileId"
    )
    ORDER BY t."isDefault" DESC, t."createdAt" ASC
    LIMIT 1
  )
)
WHERE ecs."teamId" IS NULL;

-- Remove assinaturas órfãs sem time resolvível (se houver)
DELETE FROM "public"."corretor_studio_email_credit_subscriptions"
WHERE "teamId" IS NULL;

-- Consolida duplicatas por teamId (vários profileId legados → mesmo time)
DO $$
DECLARE
  v_team_id UUID;
  v_keeper_id UUID;
  v_dup_id UUID;
  v_usage RECORD;
  v_keeper_usage_id UUID;
BEGIN
  FOR v_team_id IN
    SELECT ecs."teamId"
    FROM "public"."corretor_studio_email_credit_subscriptions" AS ecs
    GROUP BY ecs."teamId"
    HAVING COUNT(*) > 1
  LOOP
    SELECT s."id"
    INTO v_keeper_id
    FROM "public"."corretor_studio_email_credit_subscriptions" AS s
    LEFT JOIN "public"."corretor_studio_email_credit_usages" AS u
      ON u."subscriptionId" = s."id"
      AND u."periodStart" = s."currentPeriodStart"
    WHERE s."teamId" = v_team_id
    ORDER BY
      CASE s."status"
        WHEN 'active' THEN 0
        WHEN 'suspended' THEN 1
        ELSE 2
      END,
      COALESCE(u."creditsUsed", 0) DESC,
      s."updatedAt" DESC
    LIMIT 1;

    FOR v_dup_id IN
      SELECT s."id"
      FROM "public"."corretor_studio_email_credit_subscriptions" AS s
      WHERE s."teamId" = v_team_id
        AND s."id" <> v_keeper_id
    LOOP
      FOR v_usage IN
        SELECT u.*
        FROM "public"."corretor_studio_email_credit_usages" AS u
        WHERE u."subscriptionId" = v_dup_id
      LOOP
        SELECT u."id"
        INTO v_keeper_usage_id
        FROM "public"."corretor_studio_email_credit_usages" AS u
        WHERE u."subscriptionId" = v_keeper_id
          AND u."periodStart" = v_usage."periodStart"
        LIMIT 1;

        IF v_keeper_usage_id IS NOT NULL THEN
          UPDATE "public"."corretor_studio_email_credit_usages"
          SET
            "creditsUsed" = "creditsUsed" + v_usage."creditsUsed",
            "overageCount" = "overageCount" + v_usage."overageCount",
            "overageCharged" = "overageCharged" + v_usage."overageCharged",
            "updatedAt" = NOW()
          WHERE "id" = v_keeper_usage_id;

          DELETE FROM "public"."corretor_studio_email_credit_usages"
          WHERE "id" = v_usage."id";
        ELSE
          UPDATE "public"."corretor_studio_email_credit_usages"
          SET
            "subscriptionId" = v_keeper_id,
            "updatedAt" = NOW()
          WHERE "id" = v_usage."id";
        END IF;
      END LOOP;

      DELETE FROM "public"."corretor_studio_email_credit_subscriptions"
      WHERE "id" = v_dup_id;
    END LOOP;
  END LOOP;
END $$;

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
