import type { IBackofficeBackupsService } from "./IBackofficeBackupsService"
import type {
  BackofficeBackupCreateResult,
  BackofficeBackupsListResult,
} from "../context/BackofficeBackupsTypes"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response, fallbackMessage: string): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false
  if (!isJson) {
    throw new Error(fallbackMessage)
  }

  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? fallbackMessage)
  }

  return data.result
}

export class BackofficeBackupsService implements IBackofficeBackupsService {
  async list(): Promise<BackofficeBackupsListResult> {
    return parseOutput<BackofficeBackupsListResult>(
      await fetch("/api/v1/backoffice/backups", { cache: "no-store" }),
      "Erro ao carregar backups"
    )
  }

  async createManualBackup(): Promise<BackofficeBackupCreateResult> {
    return parseOutput<BackofficeBackupCreateResult>(
      await fetch("/api/v1/backoffice/backups", {
        method: "POST",
        cache: "no-store",
      }),
      "Erro ao gerar backup"
    )
  }

  getDownloadUrl(id: string): string {
    return `/api/v1/backoffice/backups/${encodeURIComponent(id)}/download`
  }
}
