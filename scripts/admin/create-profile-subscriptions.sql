-- Script: criar tabela profile_subscriptions e popular com dados existentes
-- Executar no Supabase SQL Editor (em duas etapas se preferir)

-- ============================================================
-- PASSO 1: Criar tabela
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  adhesion_id               UUID UNIQUE REFERENCES backoffice_adhesions(id) ON DELETE SET NULL,
  product_id                UUID REFERENCES backoffice_products(id) ON DELETE SET NULL,
  asaas_subscription_id     TEXT,
  asaas_installment_id      TEXT,
  subscription_status       subscription_status,
  subscription_plan         subscription_plan,
  subscription_start_date   TIMESTAMPTZ,
  subscription_end_date     TIMESTAMPTZ,
  trial_end_date            TIMESTAMPTZ,
  subscription_next_due_date TIMESTAMPTZ,
  subscription_cycle        TEXT,
  has_permanent_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_subscriptions_adhesion_id_idx  ON profile_subscriptions(adhesion_id);
CREATE INDEX IF NOT EXISTS profile_subscriptions_product_id_idx   ON profile_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS profile_subscriptions_status_idx       ON profile_subscriptions(subscription_status);

-- ============================================================
-- PASSO 2: Migrar dados existentes dos profiles
-- ============================================================

INSERT INTO profile_subscriptions (
  id,
  profile_id,
  adhesion_id,
  asaas_subscription_id,
  subscription_status,
  subscription_plan,
  subscription_start_date,
  subscription_end_date,
  trial_end_date,
  subscription_next_due_date,
  subscription_cycle,
  has_permanent_subscription,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id,
  -- Extrai adhesionId do marker "backoffice-adhesion-{uuid}"
  CASE
    WHEN p.subscription_id LIKE 'backoffice-adhesion-%'
    THEN REPLACE(p.subscription_id, 'backoffice-adhesion-', '')::uuid
    ELSE NULL
  END,
  -- asaas_subscription_id: ignora para usuários de adhesion (sem recorrência)
  CASE
    WHEN p.subscription_id LIKE 'backoffice-adhesion-%' THEN NULL
    ELSE p.asaas_subscription_id
  END,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_start_date,
  p.subscription_end_date,
  p.trial_end_date,
  p.subscription_next_due_date,
  p.subscription_cycle,
  p.has_permanent_subscription,
  now(),
  now()
FROM profiles p
WHERE p.subscription_status IS NOT NULL
   OR p.has_permanent_subscription = true
ON CONFLICT (profile_id) DO NOTHING;

-- ============================================================
-- PASSO 3: Associar productId via BackofficeUserSubscription
-- ============================================================

UPDATE profile_subscriptions ps
SET product_id = bus.product_id
FROM backoffice_user_subscriptions bus
WHERE bus.profile_id = ps.profile_id
  AND (ps.adhesion_id IS NULL OR bus.adhesion_id = ps.adhesion_id)
  AND ps.product_id IS NULL;

-- ============================================================
-- VERIFICAÇÃO (rodar após os passos acima)
-- ============================================================

-- Conferir registros criados:
-- SELECT COUNT(*) FROM profile_subscriptions;

-- Conferir profiles que deveriam ter assinatura mas não têm:
-- SELECT p.id, p.email, p.subscription_status
-- FROM profiles p
-- LEFT JOIN profile_subscriptions ps ON ps.profile_id = p.id
-- WHERE (p.subscription_status IS NOT NULL OR p.has_permanent_subscription = true)
--   AND ps.id IS NULL;
