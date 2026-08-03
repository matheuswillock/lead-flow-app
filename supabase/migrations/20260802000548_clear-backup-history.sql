-- Remove apenas registros legados (sem arquivo no Google Drive), preservando
-- qualquer backup já migrado para o Drive e backups em andamento.
DELETE FROM "public"."backoffice_database_backups"
WHERE "googleDriveFileId" IS NULL
  AND "status" != 'pending';
