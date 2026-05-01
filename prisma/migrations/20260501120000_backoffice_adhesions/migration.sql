-- Backoffice adhesions and public checkout tokens.

ALTER TYPE backoffice_lead_status ADD VALUE 'new_adhesion' BEFORE 'lost';

CREATE TYPE backoffice_adhesion_status AS ENUM (
  'pending',
  'paid',
  'overdue',
  'expired',
  'canceled'
);

CREATE TYPE backoffice_adhesion_plan AS ENUM (
  'crm'
);

CREATE TYPE backoffice_adhesion_billing_cycle AS ENUM (
  'monthly',
  'quarterly',
  'semiannual'
);

CREATE TABLE backoffice_adhesions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  "cpfCnpj" TEXT,
  "postalCode" TEXT,
  address TEXT,
  "addressNumber" TEXT,
  neighborhood TEXT,
  complement TEXT,
  city TEXT,
  state TEXT,
  plan backoffice_adhesion_plan NOT NULL DEFAULT 'crm',
  cycle backoffice_adhesion_billing_cycle NOT NULL,
  modules TEXT[] NOT NULL DEFAULT ARRAY['crm']::TEXT[],
  "extraTeams" INTEGER NOT NULL DEFAULT 0,
  "extraUsers" INTEGER NOT NULL DEFAULT 0,
  "monthlyBaseAmount" NUMERIC(12, 2) NOT NULL,
  "monthlyExtraTeamsAmount" NUMERIC(12, 2) NOT NULL,
  "monthlyExtraUsersAmount" NUMERIC(12, 2) NOT NULL,
  "monthlyTotalAmount" NUMERIC(12, 2) NOT NULL,
  "totalAmount" NUMERIC(12, 2) NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  status backoffice_adhesion_status NOT NULL DEFAULT 'pending',
  "sdrBackofficeUserId" UUID,
  "closerBackofficeUserId" UUID,
  "createdByBackofficeUserId" UUID,
  "asaasCustomerId" TEXT,
  "asaasPaymentId" TEXT,
  "billingType" TEXT,
  "paymentDueDate" TIMESTAMPTZ,
  "invoiceUrl" TEXT,
  "bankSlipUrl" TEXT,
  "pixQrCode" TEXT,
  "pixPayload" TEXT,
  "paidAt" TIMESTAMPTZ,
  "overdueAt" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ,
  "createdProfileId" UUID,
  "createdSupabaseId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT backoffice_adhesions_lead_id_fkey
    FOREIGN KEY ("leadId") REFERENCES backoffice_leads(id) ON DELETE RESTRICT,
  CONSTRAINT backoffice_adhesions_sdr_user_id_fkey
    FOREIGN KEY ("sdrBackofficeUserId") REFERENCES backoffice_users(id) ON DELETE SET NULL,
  CONSTRAINT backoffice_adhesions_closer_user_id_fkey
    FOREIGN KEY ("closerBackofficeUserId") REFERENCES backoffice_users(id) ON DELETE SET NULL,
  CONSTRAINT backoffice_adhesions_creator_user_id_fkey
    FOREIGN KEY ("createdByBackofficeUserId") REFERENCES backoffice_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX backoffice_adhesions_lead_id_key
  ON backoffice_adhesions ("leadId");

CREATE UNIQUE INDEX backoffice_adhesions_token_hash_key
  ON backoffice_adhesions ("tokenHash");

CREATE UNIQUE INDEX backoffice_adhesions_asaas_payment_id_key
  ON backoffice_adhesions ("asaasPaymentId")
  WHERE "asaasPaymentId" IS NOT NULL;

CREATE INDEX backoffice_adhesions_status_idx
  ON backoffice_adhesions (status);

CREATE INDEX backoffice_adhesions_expires_at_idx
  ON backoffice_adhesions ("expiresAt");

CREATE INDEX backoffice_adhesions_lead_id_idx
  ON backoffice_adhesions ("leadId");

CREATE INDEX backoffice_adhesions_sdr_user_id_idx
  ON backoffice_adhesions ("sdrBackofficeUserId");

CREATE INDEX backoffice_adhesions_closer_user_id_idx
  ON backoffice_adhesions ("closerBackofficeUserId");
