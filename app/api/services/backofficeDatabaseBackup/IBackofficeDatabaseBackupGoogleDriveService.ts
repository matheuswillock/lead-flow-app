export type DriveUploadInput = {
  buffer: Buffer
  fileName: string
}

export type DriveUploadResult = {
  fileId: string
  downloadUrl: string
}

export interface IBackofficeDatabaseBackupGoogleDriveService {
  upload(input: DriveUploadInput): Promise<DriveUploadResult>
}
