-- Rename cnpj to cpfCnpj in backoffice_leads table
ALTER TABLE "backoffice_leads" RENAME COLUMN "cnpj" TO "cpfCnpj";

-- Rename the index to match the new column name
DROP INDEX IF EXISTS "backoffice_leads_cnpj_idx";
CREATE INDEX "backoffice_leads_cpf_cnpj_idx" ON "backoffice_leads"("cpfCnpj");
