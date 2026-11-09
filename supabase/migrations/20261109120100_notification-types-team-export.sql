-- Notificações da exportação feita ao excluir um time: arquivo pronto e exportação com falha.
-- Apenas altera o enum; fica em arquivo próprio porque um valor novo de enum não pode ser
-- usado na mesma transação em que é criado.
-- Rollback: valores de enum não são removíveis sem recriar o tipo; os valores novos são inofensivos se ficarem sem uso.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_EXPORT_READY';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_EXPORT_FAILED';
