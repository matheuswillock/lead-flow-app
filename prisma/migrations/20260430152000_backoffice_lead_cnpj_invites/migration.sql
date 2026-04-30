ALTER TABLE "backoffice_leads"
  ADD COLUMN IF NOT EXISTS "cnpj" TEXT,
  ADD COLUMN IF NOT EXISTS "meetingExtraGuests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "backoffice_leads_cnpj_idx"
  ON "backoffice_leads" ("cnpj");
