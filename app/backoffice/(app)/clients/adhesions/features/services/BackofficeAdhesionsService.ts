import type {
  BackofficeAdhesionCreationResult,
  BackofficeAdhesionFilters,
  BackofficeAdhesionFormValues,
  BackofficeAdhesionListResult,
  BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"
import type { IBackofficeAdhesionsService } from "./IBackofficeAdhesionsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface OutputResponse<T> {
  isValid: boolean
  successMessages?: string[]
  errorMessages?: string[]
  result?: T
}

export class BackofficeAdhesionsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isValidationError: boolean
  ) {
    super(message)
    this.name = "BackofficeAdhesionsRequestError"
  }
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new BackofficeAdhesionsRequestError(
      data.errorMessages?.[0] ?? "Erro ao processar adesão",
      response.status,
      response.status >= 400 && response.status < 500
    )
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
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions?${search.toString()}`, {
        cache: "no-store",
      })
    )
  }

  async getOptions(): Promise<BackofficeAdhesionOptions> {
    return parseOutput<BackofficeAdhesionOptions>(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/options`, { cache: "no-store" })
    )
  }

  async create(
    values: BackofficeAdhesionFormValues & { accessExpiresAt?: string | null }
  ): Promise<BackofficeAdhesionCreationResult> {
    return parseOutput<BackofficeAdhesionCreationResult>(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    )
  }

  async update(
    id: string,
    values: Partial<Omit<BackofficeAdhesionFormValues, "leadId">>
  ): Promise<void> {
    await parseOutput(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    )
  }

  async deletePending(id: string): Promise<void> {
    await parseOutput(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}`, {
        method: "DELETE",
      })
    )
  }

  async resend(id: string): Promise<BackofficeAdhesionCreationResult> {
    return parseOutput<BackofficeAdhesionCreationResult>(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}/resend`, {
        method: "POST",
      })
    )
  }

  async getPublicUrl(id: string): Promise<{ publicUrl: string; expiresAt: string }> {
    return parseOutput<{ publicUrl: string; expiresAt: string }>(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}/public-url`, {
        cache: "no-store",
      })
    )
  }

  async getPendingInvoiceUrls(id: string): Promise<{
    invoices: Array<{ installmentIndex: number; amount: number; invoiceUrl: string }>
  }> {
    return parseOutput<{
      invoices: Array<{ installmentIndex: number; amount: number; invoiceUrl: string }>
    }>(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}/pending-invoice-url`, {
        cache: "no-store",
      })
    )
  }

  async resendInvite(id: string): Promise<void> {
    await parseOutput(
      await fetch(`${API_CLIENT_BASE}/backoffice/adhesions/${id}/invite`, {
        method: "POST",
      })
    )
  }
}
