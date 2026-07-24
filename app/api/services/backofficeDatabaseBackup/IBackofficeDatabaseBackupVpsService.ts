export type VpsBackupRunResult = {
  ok: boolean
  filePath?: string
  fileName?: string
  sizeBytes?: number
  checksumSha256?: string
  storageSyncPath?: string | null
  error?: string
}

export interface IBackofficeDatabaseBackupVpsService {
  runBackup(backupId: string): Promise<VpsBackupRunResult>
  downloadBackup(input: {
    fileName: string
    filePath?: string | null
  }): Promise<Response>
}
