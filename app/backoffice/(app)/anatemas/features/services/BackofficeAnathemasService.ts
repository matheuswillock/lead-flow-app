import type { IBackofficeAnathemasService } from "./IBackofficeAnathemasService"
import type {
  BackofficeAnathemaItem,
  BackofficeAnathemasFilters,
  BackofficeAnathemasListResult,
} from "../context/BackofficeAnathemasTypes"

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

export class BackofficeAnathemasService implements IBackofficeAnathemasService {
  async list(params?: {
    filters?: Partial<BackofficeAnathemasFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAnathemasListResult> {
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 20, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    const status = params?.filters?.status
    if (status && status !== "all") {
      search.set("status", status)
    }

    const query = params?.filters?.query?.trim()
    if (query) {
      search.set("q", query)
    }

    return parseOutput<BackofficeAnathemasListResult>(
      await fetch(`/api/v1/backoffice/anatemas?${search.toString()}`, { cache: "no-store" }),
      "Erro ao carregar anatemas"
    )
  }

  async banUser(profileId: string, reason?: string | null): Promise<BackofficeAnathemaItem> {
    return parseOutput<BackofficeAnathemaItem>(
      await fetch("/api/v1/backoffice/anatemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, reason }),
      }),
      "Erro ao banir usuário"
    )
  }

  async liftBan(banId: string, liftReason?: string | null): Promise<BackofficeAnathemaItem> {
    return parseOutput<BackofficeAnathemaItem>(
      await fetch(`/api/v1/backoffice/anatemas/${encodeURIComponent(banId)}/lift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liftReason }),
      }),
      "Erro ao desbanir usuário"
    )
  }
}
