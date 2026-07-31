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
  async upload({ buffer, fileName }: DriveUploadInput): Promise<DriveUploadResult> {
    const serviceAccountJson =
      process.env.BACKOFFICE_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
    const folderId = process.env.BACKOFFICE_GOOGLE_DRIVE_BACKUP_FOLDER_ID

    if (!serviceAccountJson) {
      throw new Error(
        "Variável BACKOFFICE_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON não configurada"
      )
    }
    if (!folderId) {
      throw new Error(
        "Variável BACKOFFICE_GOOGLE_DRIVE_BACKUP_FOLDER_ID não configurada"
      )
    }

    const credentials = JSON.parse(serviceAccountJson) as object

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    })

    const drive = google.drive({ version: "v3", auth })

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: "application/zip",
      },
      media: {
        mimeType: "application/zip",
        body: Readable.from(buffer),
      },
      fields: "id,webContentLink",
    })

    const fileId = createResponse.data.id
    if (!fileId) {
      throw new Error("Google Drive não retornou ID do arquivo após upload")
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    })

    const meta = await drive.files.get({
      fileId,
      fields: "webContentLink",
    })

    const downloadUrl = meta.data.webContentLink
    if (!downloadUrl) {
      throw new Error(
        "Google Drive não retornou webContentLink após criação da permissão"
      )
    }

    return { fileId, downloadUrl }
  }
}
