import type { IBackofficeBackupsService } from "./IBackofficeBackupsService"
import type {
  BackofficeBackupCreateResult,
  BackofficeBackupDownloadResult,
  BackofficeBackupsListResult,
} from "../context/BackofficeBackupsTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

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

function parseContentDispositionFileName(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = header.match(/filename="([^"]+)"/)
  return match?.[1] ?? fallback
}

export class BackofficeBackupsService implements IBackofficeBackupsService {
  async list(): Promise<BackofficeBackupsListResult> {
    return parseOutput<BackofficeBackupsListResult>(
      await fetch(`${API_CLIENT_BASE}/backoffice/backups`, { cache: "no-store" }),
      "Erro ao carregar backups"
    )
  }

  async createManualBackup(): Promise<BackofficeBackupCreateResult> {
    return parseOutput<BackofficeBackupCreateResult>(
      await fetch(`${API_CLIENT_BASE}/backoffice/backups`, {
        method: "POST",
        cache: "no-store",
      }),
      "Erro ao gerar backup"
    )
  }

  async download(id: string): Promise<BackofficeBackupDownloadResult> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/backups/${encodeURIComponent(id)}/download`,
      { cache: "no-store" }
    )

    if (!response.ok) {
      const isJson = response.headers.get("content-type")?.includes("application/json") ?? false
      if (isJson) {
        const data = (await response.json()) as OutputResponse<unknown>
        throw new Error(data.errorMessages?.[0] ?? "Erro ao baixar backup")
      }
      throw new Error("Erro ao baixar backup")
    }

    const fileName = parseContentDispositionFileName(
      response.headers.get("Content-Disposition"),
      `backup-${id}.sql.gz`
    )

    return {
      blob: await response.blob(),
      fileName,
    }
  }
}
