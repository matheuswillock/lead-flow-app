-- Ledger de parcelas da adesão (pagamento externo parcial + saldo Asaas)
ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "installmentSchedule" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "installmentLedger" JSONB NOT NULL DEFAULT '[]'::jsonb;
