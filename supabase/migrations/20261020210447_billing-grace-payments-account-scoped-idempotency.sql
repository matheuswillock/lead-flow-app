-- A chave de idempotência é enviada pelo cliente. Uma unicidade global deixava uma conta
-- colidir com (e, antes da correção no serviço, receber) o pagamento de outra conta que
-- usou a mesma chave. Ela passa a ser única por conta.
--
-- Seguro para os dados existentes: (account_id, idempotency_key) é mais fraca que a
-- unicidade global anterior, então nenhuma linha atual pode violá-la.
-- Rollback: recriar "billing_grace_payments_idempotency_key_key" UNIQUE ("idempotency_key")
-- só é possível enquanto não houver a mesma chave em contas diferentes.

CREATE UNIQUE INDEX IF NOT EXISTS "billing_grace_payments_account_idempotency_key"
  ON "public"."billing_grace_payments" ("account_id", "idempotency_key");

ALTER TABLE "public"."billing_grace_payments"
  DROP CONSTRAINT IF EXISTS "billing_grace_payments_idempotency_key_key";
