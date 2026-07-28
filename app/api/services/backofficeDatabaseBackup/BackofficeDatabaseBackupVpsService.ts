import type {
  IBackofficeDatabaseBackupVpsService,
  VpsBackupRunResult,
} from "./IBackofficeDatabaseBackupVpsService"

const DEFAULT_OPS_BACKUP_RUN_URL = "https://ops.corretorstudio.com/backup/run"

function resolveBackupVpsConfig():
  | { ok: true; webhookUrl: string; token: string }
  | { ok: false; error: string } {
  const token =
    process.env.BACKUP_VPS_TOKEN?.trim() ||
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN?.trim()

  const webhookUrl =
    process.env.BACKUP_VPS_WEBHOOK_URL?.trim() || DEFAULT_OPS_BACKUP_RUN_URL

  if (!token) {
    return {
      ok: false,
      error:
        "Token de backup não configurado (BACKUP_VPS_TOKEN ou BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN)",
    }
  }

  return { ok: true, webhookUrl, token }
}

export class BackofficeDatabaseBackupVpsService implements IBackofficeDatabaseBackupVpsService {
  async runBackup(backupId: string): Promise<VpsBackupRunResult> {
    const config = resolveBackupVpsConfig()
    if (!config.ok) {
      return { ok: false, error: config.error }
    }

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ backupId }),
    })

    const payload = (await response.json().catch(() => ({}))) as VpsBackupRunResult & {
      error?: string
      ok?: boolean
    }

    if (!response.ok) {
      return {
        ok: false,
        error: payload.error || `HTTP ${response.status}`,
      }
    }

    if (payload.ok === false) {
      return {
        ok: false,
        error: payload.error || "VPS retornou ok=false",
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
    const config = resolveBackupVpsConfig()
    if (!config.ok) {
      throw new Error(config.error)
    }

    const downloadUrl = new URL(config.webhookUrl)
    downloadUrl.pathname = downloadUrl.pathname.replace(/\/backup\/run\/?$/, "/backup/download")
    if (!downloadUrl.pathname.includes("/backup/download")) {
      downloadUrl.pathname = "/backup/download"
    }
    downloadUrl.searchParams.set("file", input.fileName)
    if (input.filePath) {
      downloadUrl.searchParams.set("path", input.filePath)
    }

    return fetch(downloadUrl.toString(), {
      headers: { Authorization: `Bearer ${config.token}` },
    })
  }
}
