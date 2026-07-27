import type {
  BackofficeBackupCreateResult,
  BackofficeBackupDownloadResult,
  BackofficeBackupsListResult,
} from "../context/BackofficeBackupsTypes"

export interface IBackofficeBackupsService {
  list(): Promise<BackofficeBackupsListResult>
  createManualBackup(): Promise<BackofficeBackupCreateResult>
  download(id: string): Promise<BackofficeBackupDownloadResult>
}
