DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_product_type') THEN
    CREATE TYPE backoffice_product_type AS ENUM ('PLAN', 'ADDON');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_product_billing_mode') THEN
    CREATE TYPE backoffice_product_billing_mode AS ENUM ('RECURRING', 'LIFETIME');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_subscription_status') THEN
    CREATE TYPE backoffice_subscription_status AS ENUM ('active', 'suspended', 'canceled', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS backoffice_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  type backoffice_product_type NOT NULL,
  "billingMode" backoffice_product_billing_mode NOT NULL DEFAULT 'RECURRING',
  "priceMonthly" NUMERIC(10, 2),
  "priceQuarterly" NUMERIC(10, 2),
  "priceSemiannual" NUMERIC(10, 2),
  "priceLifetime" NUMERIC(10, 2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_products_slug_key
  ON backoffice_products (slug);

CREATE INDEX IF NOT EXISTS backoffice_products_slug_idx
  ON backoffice_products (slug);

CREATE INDEX IF NOT EXISTS backoffice_products_type_is_active_idx
  ON backoffice_products (type, "isActive");

CREATE TABLE IF NOT EXISTS backoffice_user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  status backoffice_subscription_status NOT NULL DEFAULT 'active',
  cycle backoffice_adhesion_billing_cycle,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ,
  "adhesionId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT backoffice_user_subscriptions_profile_id_fkey
    FOREIGN KEY ("profileId") REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT backoffice_user_subscriptions_product_id_fkey
    FOREIGN KEY ("productId") REFERENCES backoffice_products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS backoffice_user_subscriptions_profile_id_status_idx
  ON backoffice_user_subscriptions ("profileId", status);

CREATE INDEX IF NOT EXISTS backoffice_user_subscriptions_product_id_idx
  ON backoffice_user_subscriptions ("productId");

CREATE INDEX IF NOT EXISTS backoffice_user_subscriptions_adhesion_id_idx
  ON backoffice_user_subscriptions ("adhesionId");

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_user_subscriptions_profile_id_product_id_key
  ON backoffice_user_subscriptions ("profileId", "productId");

INSERT INTO backoffice_products (
  id,
  name,
  slug,
  description,
  type,
  "billingMode",
  "priceMonthly",
  "priceQuarterly",
  "priceSemiannual",
  "priceLifetime",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (gen_random_uuid(), 'CRM', 'crm', 'Plano CRM - acesso completo ao modulo de gestao de leads.', 'PLAN', 'RECURRING', 79.90, 69.90, 59.90, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), 'CRM Vitalicio', 'crm-lifetime', 'Plano CRM com acesso vitalicio - pagamento unico, sem mensalidade.', 'PLAN', 'LIFETIME', NULL, NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), 'Time Adicional', 'extra-team', 'Adiciona um time extra a conta.', 'ADDON', 'RECURRING', 29.90, 29.90, 29.90, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), 'Usuario Adicional', 'extra-user', 'Adiciona um usuario operador extra a conta.', 'ADDON', 'RECURRING', 19.90, 19.90, 19.90, NULL, true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
