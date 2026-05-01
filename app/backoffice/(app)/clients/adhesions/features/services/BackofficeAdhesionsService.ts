import type {
  BackofficeAdhesionCreationResult,
  BackofficeAdhesionFilters,
  BackofficeAdhesionFormValues,
  BackofficeAdhesionListResult,
  BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"
import type { IBackofficeAdhesionsService } from "./IBackofficeAdhesionsService"

interface OutputResponse<T> {
  isValid: boolean
  successMessages?: string[]
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? "Erro ao processar adesão")
  }
  return data.result
}

export class BackofficeAdhesionsService implements IBackofficeAdhesionsService {
  async list(params?: {
    filters?: Partial<BackofficeAdhesionFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAdhesionListResult> {
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 10, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    const query = params?.filters?.query?.trim()
    if (query) search.set("q", query)
    if (params?.filters?.status && params.filters.status !== "all") {
      search.set("status", params.filters.status)
    }

    return parseOutput<BackofficeAdhesionListResult>(
      await fetch(`/api/v1/backoffice/adhesions?${search.toString()}`, {
        cache: "no-store",
      })
    )
  }

  async getOptions(): Promise<BackofficeAdhesionOptions> {
    return parseOutput<BackofficeAdhesionOptions>(
      await fetch("/api/v1/backoffice/adhesions/options", { cache: "no-store" })
    )
  }

  async create(values: BackofficeAdhesionFormValues): Promise<BackofficeAdhesionCreationResult> {
    return parseOutput<BackofficeAdhesionCreationResult>(
      await fetch("/api/v1/backoffice/adhesions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    )
  }

  async update(id: string, values: Omit<BackofficeAdhesionFormValues, "leadId">): Promise<void> {
    await parseOutput(
      await fetch(`/api/v1/backoffice/adhesions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    )
  }

  async resend(id: string): Promise<BackofficeAdhesionCreationResult> {
    return parseOutput<BackofficeAdhesionCreationResult>(
      await fetch(`/api/v1/backoffice/adhesions/${id}/resend`, {
        method: "POST",
      })
    )
  }
}
