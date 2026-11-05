-- Flag de cartão gerida no backoffice. Nasce desligada; só o dono liga, depois que o Abacate liberar o cartão.
-- A tabela já tem RLS, REVOKE e política service_role (20261018120000); coluna nova não altera isso.
ALTER TABLE public.payment_provider_configs
  ADD COLUMN IF NOT EXISTS card_enabled boolean NOT NULL DEFAULT false;
