-- Persist hasUnlimitedUsers on master profile and adhesion intent.
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "hasUnlimitedUsers" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "hasUnlimitedUsers" boolean NOT NULL DEFAULT false;

-- Backfill adhesion intent: annual cycle always unlimited.
UPDATE "public"."backoffice_adhesions"
SET "hasUnlimitedUsers" = true
WHERE "cycle" = 'annual'
  AND "hasUnlimitedUsers" = false;

-- Backfill masters that should have unlimited users:
-- vitalício, adesão anual paga, Member PRO ativo (grava a flag; runtime não usa mais fallback).
UPDATE "public"."corretor_studio_profiles" p
SET "hasUnlimitedUsers" = true
WHERE p."hasUnlimitedUsers" = false
  AND (
    p."hasPermanentSubscription" = true
    OR EXISTS (
      SELECT 1
      FROM "public"."backoffice_adhesions" a
      WHERE a."createdProfileId" = p.id
        AND a.status = 'paid'
        AND a.cycle = 'annual'
    )
    OR EXISTS (
      SELECT 1
      FROM "public"."profile_user_type_assignments" uta
      INNER JOIN "public"."profile_user_types" ut ON ut.id = uta."userTypeId"
      WHERE uta."profileId" = p.id
        AND ut.slug = 'member_pro'
        AND (uta."accessExpiresAt" IS NULL OR uta."accessExpiresAt" > now())
    )
  );
