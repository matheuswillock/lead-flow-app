import type {
  IBackofficeDatabaseBackupVpsService,
  VpsBackupRunResult,
} from "./IBackofficeDatabaseBackupVpsService"

export class BackofficeDatabaseBackupVpsService implements IBackofficeDatabaseBackupVpsService {
  async runBackup(backupId: string): Promise<VpsBackupRunResult> {
    const webhookUrl = process.env.BACKUP_VPS_WEBHOOK_URL?.trim()
    const token = process.env.BACKUP_VPS_TOKEN?.trim()

    if (!webhookUrl || !token) {
      return {
        ok: false,
        error: "BACKUP_VPS_WEBHOOK_URL ou BACKUP_VPS_TOKEN não configurados",
      }
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ backupId }),
    })

    const payload = (await response.json().catch(() => ({}))) as VpsBackupRunResult & {
      error?: string
    }

    if (!response.ok) {
      return {
        ok: false,
        error: payload.error || `HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      filePath: payload.filePath,
      fileName: payload.fileName,
      sizeBytes: payload.sizeBytes,
      checksumSha256: payload.checksumSha256,
      storageSyncPath: payload.storageSyncPath ?? null,
    }
  }

  async downloadBackup(input: {
    fileName: string
    filePath?: string | null
  }): Promise<Response> {
    const webhookBase = process.env.BACKUP_VPS_WEBHOOK_URL?.trim()
    const token = process.env.BACKUP_VPS_TOKEN?.trim()
    if (!webhookBase || !token) {
      throw new Error("Integração de backup não configurada")
    }

    const downloadUrl = new URL(webhookBase)
    downloadUrl.pathname = downloadUrl.pathname.replace(/\/backup\/run\/?$/, "/backup/download")
    if (!downloadUrl.pathname.includes("/backup/download")) {
      downloadUrl.pathname = "/backup/download"
    }
    downloadUrl.searchParams.set("file", input.fileName)
    if (input.filePath) {
      downloadUrl.searchParams.set("path", input.filePath)
    }

    return fetch(downloadUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}
