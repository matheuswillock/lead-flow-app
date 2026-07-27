export type BackofficeDatabaseBackupStatus = "pending" | "success" | "failed"
export type BackofficeDatabaseBackupSource = "cron" | "manual"

export interface BackofficeBackupItem {
  id: string
  startedAt: string
  finishedAt: string | null
  status: BackofficeDatabaseBackupStatus
  source: BackofficeDatabaseBackupSource
  triggeredByProfileId: string | null
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

export interface BackofficeBackupCreateResult {
  id: string
}
