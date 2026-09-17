import { Readable } from "node:stream"
import { google } from "googleapis"
import type {
  IBackofficeDatabaseBackupGoogleDriveService,
  DriveUploadInput,
  DriveUploadResult,
} from "./IBackofficeDatabaseBackupGoogleDriveService"

export class BackofficeDatabaseBackupGoogleDriveService
  implements IBackofficeDatabaseBackupGoogleDriveService
{
  private getAuth() {
    const serviceAccountJson =
      process.env.BACKOFFICE_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON

    if (!serviceAccountJson) {
      throw new Error(
        "Variável BACKOFFICE_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON não configurada"
      )
    }

    const credentials = JSON.parse(serviceAccountJson) as object

    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    })
  }

  async upload({ body, fileName }: DriveUploadInput): Promise<DriveUploadResult> {
    const folderId = process.env.BACKOFFICE_GOOGLE_DRIVE_BACKUP_FOLDER_ID

    if (!folderId) {
      throw new Error(
        "Variável BACKOFFICE_GOOGLE_DRIVE_BACKUP_FOLDER_ID não configurada"
      )
    }

    const drive = google.drive({ version: "v3", auth: this.getAuth() })

    const createResponse = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: "application/zip",
      },
      media: {
        mimeType: "application/zip",
        body,
      },
      fields: "id",
    })

    const fileId = createResponse.data.id
    if (!fileId) {
      throw new Error("Google Drive não retornou ID do arquivo após upload")
    }

    return { fileId }
  }

  async downloadStream(fileId: string): Promise<ReadableStream<Uint8Array>> {
    const drive = google.drive({ version: "v3", auth: this.getAuth() })

    const response = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    )

    return Readable.toWeb(response.data) as unknown as ReadableStream<Uint8Array>
  }
}
