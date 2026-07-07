-- BackofficeOperationalAccessGrant: acessos operacionais (Associados + MultiSkill origem)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BackofficeOperationalCapability') THEN
    CREATE TYPE "public"."BackofficeOperationalCapability" AS ENUM (
      'ASSOCIADOS_QUEUE',
      'MULTISKILL_TRANSFER_ORIGIN'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."backoffice_operational_access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "capability" "public"."BackofficeOperationalCapability" NOT NULL,
    "profileId" UUID,
    "teamId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "grantedByProfileId" UUID,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByProfileId" UUID,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backoffice_operational_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backoffice_operational_access_grants_capability_active_idx"
    ON "public"."backoffice_operational_access_grants"("capability", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_operational_access_grants_associados_profile_key"
    ON "public"."backoffice_operational_access_grants"("capability", "profileId")
    WHERE "profileId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_operational_access_grants_multiskill_team_key"
    ON "public"."backoffice_operational_access_grants"("capability", "teamId")
    WHERE "teamId" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_operational_access_grants_capability_target_check'
  ) THEN
    ALTER TABLE "public"."backoffice_operational_access_grants"
      ADD CONSTRAINT "backoffice_operational_access_grants_capability_target_check"
      CHECK (
        (
          "capability" = 'ASSOCIADOS_QUEUE'
          AND "profileId" IS NOT NULL
          AND "teamId" IS NULL
        )
        OR (
          "capability" = 'MULTISKILL_TRANSFER_ORIGIN'
          AND "teamId" IS NOT NULL
          AND "profileId" IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_operational_access_grants_profileId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_operational_access_grants"
      ADD CONSTRAINT "backoffice_operational_access_grants_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_operational_access_grants_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_operational_access_grants"
      ADD CONSTRAINT "backoffice_operational_access_grants_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_operational_access_grants_grantedByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_operational_access_grants"
      ADD CONSTRAINT "backoffice_operational_access_grants_grantedByProfileId_fkey"
      FOREIGN KEY ("grantedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'backoffice_operational_access_grants_revokedByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_operational_access_grants"
      ADD CONSTRAINT "backoffice_operational_access_grants_revokedByProfileId_fkey"
      FOREIGN KEY ("revokedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed: fila Associados (Bruno + Matheus)
INSERT INTO "public"."backoffice_operational_access_grants"
  ("id", "capability", "profileId", "teamId", "isActive", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'ASSOCIADOS_QUEUE'::"public"."BackofficeOperationalCapability",
  p."id",
  NULL,
  true,
  'Seed inicial',
  now(),
  now()
FROM "public"."corretor_studio_profiles" p
WHERE p."email" IN ('bruno@onsidemarketing.com.br', 'matheuswillock@gmail.com')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."backoffice_operational_access_grants" g
    WHERE g."capability" = 'ASSOCIADOS_QUEUE'
      AND g."profileId" = p."id"
  );

-- Seed: origem MultiSkill (time MultiSkill do Bruno)
INSERT INTO "public"."backoffice_operational_access_grants"
  ("id", "capability", "profileId", "teamId", "isActive", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'MULTISKILL_TRANSFER_ORIGIN'::"public"."BackofficeOperationalCapability",
  NULL,
  t."id",
  true,
  'Seed inicial',
  now(),
  now()
FROM "public"."corretor_studio_teams" t
JOIN "public"."corretor_studio_profiles" p ON p."id" = t."masterId"
WHERE p."email" = 'bruno@onsidemarketing.com.br'
  AND t."name" = 'MultiSkill'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."backoffice_operational_access_grants" g
    WHERE g."capability" = 'MULTISKILL_TRANSFER_ORIGIN'
      AND g."teamId" = t."id"
  );

-- Remover features operacionais do catálogo de vendas
DELETE FROM "public"."backoffice_feature_grant_teams"
WHERE "grantId" IN (
  SELECT g."id"
  FROM "public"."backoffice_feature_grants" g
  JOIN "public"."backoffice_features" f ON f."id" = g."featureId"
  WHERE f."slug" IN ('crm-backoffice-associados', 'crm-multiskill-transfers')
);

DELETE FROM "public"."backoffice_feature_grants"
WHERE "featureId" IN (
  SELECT "id" FROM "public"."backoffice_features"
  WHERE "slug" IN ('crm-backoffice-associados', 'crm-multiskill-transfers')
);

DELETE FROM "public"."backoffice_feature_access_rules"
WHERE "featureId" IN (
  SELECT "id" FROM "public"."backoffice_features"
  WHERE "slug" IN ('crm-backoffice-associados', 'crm-multiskill-transfers')
);

DELETE FROM "public"."backoffice_features"
WHERE "slug" IN ('crm-backoffice-associados', 'crm-multiskill-transfers');
