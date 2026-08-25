import type { Readable } from "node:stream"

export type DriveUploadInput = {
  /**
   * Corpo em stream: o arquivo é enviado enquanto ainda está sendo gerado, sem
   * nunca existir inteiro em memória.
   */
  body: Readable
  fileName: string
}

export type DriveUploadResult = {
  fileId: string
}

export interface IBackofficeDatabaseBackupGoogleDriveService {
  upload(input: DriveUploadInput): Promise<DriveUploadResult>
  downloadStream(fileId: string): Promise<ReadableStream<Uint8Array>>
}
