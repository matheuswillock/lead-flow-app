export type DriveUploadInput = {
  buffer: Buffer
  fileName: string
}

export type DriveUploadResult = {
  fileId: string
}

export interface IBackofficeDatabaseBackupGoogleDriveService {
  upload(input: DriveUploadInput): Promise<DriveUploadResult>
  downloadStream(fileId: string): Promise<ReadableStream<Uint8Array>>
}
