-- Seed idempotente: backfill patrocinadores autorizados (ASSOCIATED_SPONSOR_SPEC D3)

-- (a) Backfill: profiles já marcados com canSponsorAccounts
INSERT INTO "public"."backoffice_authorized_sponsors"
    ("id", "profileId", "isActive", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", true, now(), now(), now()
FROM "public"."corretor_studio_profiles" p
WHERE p."canSponsorAccounts" = true
ON CONFLICT ("profileId") DO NOTHING;

-- (b) Bruno (ambas grafias) e Matheus
INSERT INTO "public"."backoffice_authorized_sponsors"
    ("id", "profileId", "isActive", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", true, now(), now(), now()
FROM "public"."corretor_studio_profiles" p
WHERE p."email" IN (
    'bruno@onsidemarketing.com.br',
    'bruno@onseidemarketing.com.br',
    'matheuswillock@gmail.com'
)
ON CONFLICT ("profileId") DO NOTHING;

-- (c) Warning se nenhum profile Bruno foi autorizado
DO $$
DECLARE
    v_bruno_count integer;
BEGIN
    SELECT COUNT(*) INTO v_bruno_count
    FROM "public"."backoffice_authorized_sponsors" bas
    JOIN "public"."corretor_studio_profiles" p ON p."id" = bas."profileId"
    WHERE p."email" ILIKE 'bruno@ons%idemarketing.com.br'
      AND bas."isActive" = true;

    IF v_bruno_count = 0 THEN
        RAISE WARNING 'seed-authorized-sponsors-fix: nenhum profile Bruno autorizado — verifique e-mail em corretor_studio_profiles';
    END IF;
END $$;
