-- Na renovação o master escolhe quais usuários adicionais manter. Os que ele deixar de fora
-- ficam gravados no pagamento e só saem dos times da conta quando o pagamento é confirmado.
--
-- Seguro para os dados existentes: coluna nova com padrão vazio, então nenhuma renovação
-- antiga revoga ninguém.
-- Rollback: ALTER TABLE "public"."billing_grace_payments" DROP COLUMN "revoked_profile_ids";

ALTER TABLE "public"."billing_grace_payments"
  ADD COLUMN IF NOT EXISTS "revoked_profile_ids" uuid[] NOT NULL DEFAULT '{}';
