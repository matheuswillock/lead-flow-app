-- Anula sponsorMasterId órfãos em backoffice_adhesions (ASSOCIATED_SPONSOR_SPEC Estágio 3)

UPDATE "public"."backoffice_adhesions" a
SET "sponsorMasterId" = NULL
WHERE a."sponsorMasterId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_profiles" p
    WHERE p."id" = a."sponsorMasterId"
  );
