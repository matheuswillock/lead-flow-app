-- M11 (PAY-CRED-T011): auditoria de configuração de provider de pagamento.
-- Valor de enum isolado em migration própria: não pode ser usado na transação que o cria.
ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS 'PAYMENT_PROVIDER_CONFIG';
