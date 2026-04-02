-- Backoffice Corretor Studio
-- Cria tabelas operacionais do módulo de backoffice sem acoplar o restante do schema Prisma.

CREATE TABLE IF NOT EXISTS backoffice_users (
  id UUID PRIMARY KEY,
  "profileId" UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  "fullAccess" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "mailboxStatus" TEXT NOT NULL DEFAULT 'pending_manual_action',
  "mailboxAddress" TEXT,
  "mailboxProvisionedAt" TIMESTAMPTZ,
  "createdByProfileId" UUID REFERENCES profiles(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backoffice_users_is_active_idx
  ON backoffice_users ("isActive");

CREATE INDEX IF NOT EXISTS backoffice_users_created_by_profile_id_idx
  ON backoffice_users ("createdByProfileId");

CREATE TABLE IF NOT EXISTS backoffice_clients (
  id UUID PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  "cpfCnpj" TEXT,
  notes TEXT,
  "asaasCustomerId" TEXT UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByProfileId" UUID REFERENCES profiles(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backoffice_clients_email_idx
  ON backoffice_clients (email);

CREATE INDEX IF NOT EXISTS backoffice_clients_cpf_cnpj_idx
  ON backoffice_clients ("cpfCnpj");

CREATE INDEX IF NOT EXISTS backoffice_clients_is_active_idx
  ON backoffice_clients ("isActive");

CREATE TABLE IF NOT EXISTS backoffice_payments (
  id UUID PRIMARY KEY,
  "clientId" UUID NOT NULL REFERENCES backoffice_clients(id) ON DELETE CASCADE,
  "asaasPaymentId" TEXT UNIQUE,
  "billingType" TEXT NOT NULL DEFAULT 'PIX',
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount NUMERIC(12, 2) NOT NULL,
  "dueDate" TIMESTAMPTZ,
  description TEXT,
  "invoiceUrl" TEXT,
  "pixQrCode" TEXT,
  "pixPayload" TEXT,
  "createdByProfileId" UUID REFERENCES profiles(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backoffice_payments_client_id_idx
  ON backoffice_payments ("clientId");

CREATE INDEX IF NOT EXISTS backoffice_payments_status_idx
  ON backoffice_payments (status);

CREATE INDEX IF NOT EXISTS backoffice_payments_due_date_idx
  ON backoffice_payments ("dueDate");
