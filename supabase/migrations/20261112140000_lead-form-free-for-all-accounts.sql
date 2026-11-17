-- Achado de produção (12/11): o Formulário de Captação de Leads não deve
-- depender de `integration` nem de `radar` — não é beta, não é cobrado, é
-- liberado para todas as contas. A migration anterior
-- (20261110120000_seed-integration-feature-slugs.sql) deu a ele
-- `inheritParentSettings = true`, herdando o MASTER+MANAGER-only de
-- `integration`; aqui ele passa a ter regra própria, aberta para todos os
-- principais. Espelha prisma/seed-backoffice-products.ts.

UPDATE "public"."backoffice_features"
SET "inheritParentSettings" = false,
    "billedSeparately" = false,
    "accessMode" = 'PUBLIC',
    "defaultAccessLevel" = 'FULL',
    "betaEnabled" = false,
    "updatedAt" = now()
WHERE "slug" = 'lead-form';

DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT "id" INTO v_feature_id FROM "public"."backoffice_features" WHERE "slug" = 'lead-form';
  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MASTER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'MANAGER',          'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'BACKOFFICE',       'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'OPERATOR',         'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'SDR',              'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CLOSER',           'FULL', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_MANAGE_TEAMS', 'NONE', now(), now()),
      (gen_random_uuid(), v_feature_id, 'CAN_CREATE_USERS', 'NONE', now(), now())
    ON CONFLICT ("featureId", "principal")
    DO UPDATE SET "accessLevel" = EXCLUDED."accessLevel", "updatedAt" = now();
  END IF;
END $$;
