-- Preserve financial history for backoffice clients.
-- Replaces ON DELETE CASCADE with ON DELETE RESTRICT on backoffice_payments.clientId.

ALTER TABLE backoffice_payments
  DROP CONSTRAINT IF EXISTS "backoffice_payments_clientId_fkey";

ALTER TABLE backoffice_payments
  ADD CONSTRAINT "backoffice_payments_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES backoffice_clients(id) ON DELETE RESTRICT;
