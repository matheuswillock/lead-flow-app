import type {
  BackofficeBackupCreateResult,
  BackofficeBackupsListResult,
} from "../context/BackofficeBackupsTypes"

export interface IBackofficeBackupsService {
  list(): Promise<BackofficeBackupsListResult>
  createManualBackup(): Promise<BackofficeBackupCreateResult>
  getDownloadUrl(id: string): string
}
