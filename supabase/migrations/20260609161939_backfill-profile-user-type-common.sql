-- Re-seed profile_user_types (idempotent) and backfill any profile that
-- still has no type assignment so they default to "common".
-- Also repairs dangling userTypeId FK references that can occur after
-- db:clone:remote restores remote data whose UUIDs differ from locally-seeded ones.

INSERT INTO "profile_user_types" ("id", "slug", "name", "description")
VALUES
  (gen_random_uuid(), 'common',     'Comum',      'Tipo padrão de usuário, sem limites ou prazos especiais.'),
  (gen_random_uuid(), 'member_pro', 'Member PRO', 'Acesso com prazo definido pelo backoffice e limites configuráveis de usuários/times.')
ON CONFLICT ("slug") DO NOTHING;

-- Fix assignments whose userTypeId points to a UUID that no longer exists locally
-- (happens when remote-clone data has different UUIDs than local migration seed).
UPDATE "profile_user_type_assignments" a
SET "userTypeId" = t.id
FROM "profile_user_types" t
WHERE t.slug = 'common'
  AND NOT EXISTS (
    SELECT 1 FROM "profile_user_types" pt WHERE pt.id = a."userTypeId"
  );

-- Backfill profiles that still have no assignment at all.
INSERT INTO "profile_user_type_assignments" ("id", "profileId", "userTypeId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", t."id", now(), now()
FROM "corretor_studio_profiles" p
CROSS JOIN (SELECT "id" FROM "profile_user_types" WHERE "slug" = 'common') t
WHERE NOT EXISTS (
  SELECT 1 FROM "profile_user_type_assignments" a WHERE a."profileId" = p."id"
);
