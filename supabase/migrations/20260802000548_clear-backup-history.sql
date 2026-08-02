-- Limpa todo o histórico de backups (registros anteriores à migração para Google Drive).
DELETE FROM "public"."backoffice_database_backups";
