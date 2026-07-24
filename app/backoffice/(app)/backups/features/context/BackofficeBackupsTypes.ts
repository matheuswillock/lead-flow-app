export type BackofficeDatabaseBackupStatus = "pending" | "success" | "failed"

export interface BackofficeBackupItem {
  id: string
  startedAt: string
  finishedAt: string | null
  status: BackofficeDatabaseBackupStatus
  fileName: string | null
  sizeBytes: number | null
  checksumSha256: string | null
  storageSyncPath: string | null
  errorMessage: string | null
  createdAt: string
}

export interface BackofficeBackupsListResult {
  items: BackofficeBackupItem[]
}

export interface BackofficeBackupDownloadResult {
  blob: Blob
  fileName: string
}
