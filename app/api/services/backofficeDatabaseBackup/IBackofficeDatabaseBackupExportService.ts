export type ExportZipResult = {
  buffer: Buffer
  fileName: string
  sizeBytes: number
  checksumSha256: string
}

export interface IBackofficeDatabaseBackupExportService {
  exportToZip(): Promise<ExportZipResult>
}
