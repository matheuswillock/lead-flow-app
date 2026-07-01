-- Seed: profile user type guest (conta gratuita patrocinada, sem cobrança, recursos ilimitados)
INSERT INTO "public"."profile_user_types"
  ("id", "slug", "name", "description", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'guest',
    'Convidado',
    'Conta gratuita patrocinada sem cobrança e com recursos ilimitados (times e usuários).',
    now(),
    now()
  )
ON CONFLICT ("slug") DO NOTHING;

-- Mark designated sponsors (canSponsorAccounts = true)
-- No-op if the profile does not exist yet; idempotent on re-run.
UPDATE "public"."corretor_studio_profiles"
SET "canSponsorAccounts" = true
WHERE "email" IN ('matheuswillock@gmail.com', 'bruno@onseidemarketing.com.br');
