-- Script: criar tabela profile_subscriptions e popular com dados existentes
-- Executar no Supabase SQL Editor
-- IMPORTANTE: colunas usam camelCase com aspas (convenção deste projeto Prisma)

-- ============================================================
-- PASSO 1: Criar tabela
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_subscriptions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId"                 UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  "adhesionId"                UUID        UNIQUE REFERENCES backoffice_adhesions(id) ON DELETE SET NULL,
  "productId"                 TEXT        REFERENCES backoffice_products(id) ON DELETE SET NULL,
  "asaasSubscriptionId"       TEXT,
  "asaasInstallmentId"        TEXT,
  "subscriptionStatus"        subscription_status,
  "subscriptionPlan"          subscription_plan,
  "subscriptionStartDate"     TIMESTAMPTZ,
  "subscriptionEndDate"       TIMESTAMPTZ,
  "trialEndDate"              TIMESTAMPTZ,
  "subscriptionNextDueDate"   TIMESTAMPTZ,
  "subscriptionCycle"         TEXT,
  "hasPermanentSubscription"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_subscriptions_adhesion_id_idx ON profile_subscriptions("adhesionId");
CREATE INDEX IF NOT EXISTS profile_subscriptions_product_id_idx  ON profile_subscriptions("productId");
CREATE INDEX IF NOT EXISTS profile_subscriptions_status_idx      ON profile_subscriptions("subscriptionStatus");

-- ============================================================
-- PASSO 2: Migrar dados existentes dos profiles
-- ============================================================

INSERT INTO profile_subscriptions (
  id,
  "profileId",
  "adhesionId",
  "asaasSubscriptionId",
  "subscriptionStatus",
  "subscriptionPlan",
  "subscriptionStartDate",
  "subscriptionEndDate",
  "trialEndDate",
  "subscriptionNextDueDate",
  "subscriptionCycle",
  "hasPermanentSubscription",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  p.id,
  -- Extrai adhesionId do marker "backoffice-adhesion-{uuid}"
  CASE
    WHEN p."subscriptionId" LIKE 'backoffice-adhesion-%'
    THEN REPLACE(p."subscriptionId", 'backoffice-adhesion-', '')::uuid
    ELSE NULL
  END,
  -- asaasSubscriptionId: ignora markers de adhesion (não são IDs reais do Asaas)
  CASE
    WHEN p."subscriptionId" LIKE 'backoffice-adhesion-%' THEN NULL
    ELSE p."asaasSubscriptionId"
  END,
  p."subscriptionStatus",
  p."subscriptionPlan",
  p."subscriptionStartDate",
  p."subscriptionEndDate",
  p."trialEndDate",
  p."subscriptionNextDueDate",
  p."subscriptionCycle",
  p."hasPermanentSubscription",
  now(),
  now()
FROM profiles p
WHERE p."subscriptionStatus" IS NOT NULL
   OR p."hasPermanentSubscription" = true
ON CONFLICT ("profileId") DO NOTHING;

-- ============================================================
-- PASSO 3: Associar productId via backoffice_user_subscriptions
-- ============================================================

UPDATE profile_subscriptions ps
SET "productId" = bus."productId"
FROM backoffice_user_subscriptions bus
WHERE bus."profileId" = ps."profileId"
  AND (ps."adhesionId" IS NULL OR bus."adhesionId" = ps."adhesionId")
  AND ps."productId" IS NULL;

-- ============================================================
-- VERIFICAÇÃO (rodar após os passos acima)
-- ============================================================

-- Conferir registros criados:
-- SELECT COUNT(*) FROM profile_subscriptions;

-- Conferir profiles que deveriam ter assinatura mas não têm registro:
-- SELECT p.id, p.email, p."subscriptionStatus"
-- FROM profiles p
-- LEFT JOIN profile_subscriptions ps ON ps."profileId" = p.id
-- WHERE (p."subscriptionStatus" IS NOT NULL OR p."hasPermanentSubscription" = true)
--   AND ps.id IS NULL;
