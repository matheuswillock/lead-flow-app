-- Webhook de entrada v2 (SPEC 11, DA9): tipo de notificação do alerta "remarcar urgente".
-- Apenas altera o enum; fica em arquivo próprio porque um valor novo de enum não pode ser
-- usado na mesma transação em que é criado.
-- Rollback: valores de enum não são removíveis sem recriar o tipo; o valor novo é inofensivo se ficar sem uso.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'LEAD_NEEDS_RESCHEDULE';
