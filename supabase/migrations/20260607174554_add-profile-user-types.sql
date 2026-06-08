-- Adds user type tiers (Comum / Member PRO) for corretor_studio_profiles.
-- profile_user_types: lookup table with the tiers (seeded with "common" and "member_pro").
-- profile_user_type_assignments: 1:1 link between a Profile and its current type,
-- carrying Member PRO specific configuration (access deadline).
-- The link to corretor_studio_profiles cascades on delete and update.

CREATE TABLE IF NOT EXISTS "profile_user_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_user_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_user_types_slug_key" ON "profile_user_types"("slug");

CREATE TABLE IF NOT EXISTS "profile_user_type_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "userTypeId" UUID NOT NULL,
  "accessStartsAt" TIMESTAMPTZ(6),
  "accessExpiresAt" TIMESTAMPTZ(6),
  "assignedByProfileId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_user_type_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_user_type_assignments_profile_id_fkey"
    FOREIGN KEY ("profileId") REFERENCES "corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "profile_user_type_assignments_user_type_id_fkey"
    FOREIGN KEY ("userTypeId") REFERENCES "profile_user_types"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "profile_user_type_assignments_assigned_by_profile_id_fkey"
    FOREIGN KEY ("assignedByProfileId") REFERENCES "corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_user_type_assignments_profile_id_key" ON "profile_user_type_assignments"("profileId");
CREATE INDEX IF NOT EXISTS "profile_user_type_assignments_user_type_id_idx" ON "profile_user_type_assignments"("userTypeId");
CREATE INDEX IF NOT EXISTS "profile_user_type_assignments_access_expires_at_idx" ON "profile_user_type_assignments"("accessExpiresAt");

-- Seed the two known tiers.
INSERT INTO "profile_user_types" ("id", "slug", "name", "description")
VALUES
  (gen_random_uuid(), 'common', 'Comum', 'Tipo padrão de usuário, sem limites ou prazos especiais.'),
  (gen_random_uuid(), 'member_pro', 'Member PRO', 'Acesso com prazo definido pelo backoffice e limites configuráveis de usuários/times.')
ON CONFLICT ("slug") DO NOTHING;

-- Backfill: every existing Profile gets a "common" assignment so the badge,
-- filters and slug engine can always rely on a single join.
INSERT INTO "profile_user_type_assignments" ("id", "profileId", "userTypeId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", t."id", now(), now()
FROM "corretor_studio_profiles" p
CROSS JOIN (SELECT "id" FROM "profile_user_types" WHERE "slug" = 'common') t
WHERE NOT EXISTS (
  SELECT 1 FROM "profile_user_type_assignments" a WHERE a."profileId" = p."id"
);
