import type {
  IBackofficeDatabaseBackupVpsService,
  VpsBackupRunResult,
} from "./IBackofficeDatabaseBackupVpsService"
import {
  buildBackupDownloadUrl,
  mapVpsUnauthorizedError,
  resolveOpsAgentAuthForBackup,
} from "@/lib/studio-bot/resolve-ops-agent-auth"

export class BackofficeDatabaseBackupVpsService implements IBackofficeDatabaseBackupVpsService {
  async runBackup(backupId: string): Promise<VpsBackupRunResult> {
    const config = await resolveOpsAgentAuthForBackup()
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
        error: mapVpsUnauthorizedError(response.status, payload.error),
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
    const config = await resolveOpsAgentAuthForBackup()
    if (!config.ok) {
      throw new Error(config.error)
    }

    const downloadUrl = new URL(buildBackupDownloadUrl(config.webhookUrl))
    downloadUrl.searchParams.set("file", input.fileName)
    if (input.filePath) {
      downloadUrl.searchParams.set("path", input.filePath)
    }

    return fetch(downloadUrl.toString(), {
      headers: { Authorization: `Bearer ${config.token}` },
    })
  }
}
