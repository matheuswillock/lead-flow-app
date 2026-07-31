ALTER TABLE "public"."backoffice_database_backups"
  ADD COLUMN IF NOT EXISTS "googleDriveFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleDriveDownloadUrl" TEXT;
