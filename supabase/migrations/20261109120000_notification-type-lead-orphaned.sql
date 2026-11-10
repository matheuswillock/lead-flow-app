-- Notificação "lead ficou sem responsável": enviada ao master e aos managers quando um usuário
-- é removido do time e deixa leads abertos sem SDR/closer.
-- Apenas altera o enum; fica em arquivo próprio porque um valor novo de enum não pode ser
-- usado na mesma transação em que é criado.
-- Rollback: valores de enum não são removíveis sem recriar o tipo; o valor novo é inofensivo se ficar sem uso.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'LEAD_ORPHANED';
