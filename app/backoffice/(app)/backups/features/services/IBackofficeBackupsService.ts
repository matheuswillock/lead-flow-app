import type {
  BackofficeBackupDownloadResult,
  BackofficeBackupsListResult,
} from "../context/BackofficeBackupsTypes"

export interface IBackofficeBackupsService {
  list(): Promise<BackofficeBackupsListResult>
  download(id: string): Promise<BackofficeBackupDownloadResult>
}
