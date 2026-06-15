import type { IBackofficeClientsService } from "./IBackofficeClientsService"
import type {
  BackofficeClientsFilters,
  BackofficeClientsListResult,
} from "../context/BackofficeClientsTypes"

export class BackofficeClientsService implements IBackofficeClientsService {
  async list(params?: {
    filters?: Partial<BackofficeClientsFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeClientsListResult> {
    const search = new URLSearchParams({ view: "platform-users" })
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 10, 5)

    search.set("page", String(page))
    search.set("pageSize", String(pageSize))

    if (params?.filters?.query?.trim()) {
      search.set("q", params.filters.query.trim())
    }
    if (params?.filters?.plan && params.filters.plan !== "all") {
      search.set("plan", params.filters.plan)
    }
    if (params?.filters?.userType && params.filters.userType !== "all") {
      search.set("userType", params.filters.userType)
    }

    const res = await fetch(`/api/v1/backoffice/clients?${search.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar clientes")

    const fallbackPagination = {
      page,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    }

    return {
      items: data.result?.items ?? [],
      pagination: data.result?.pagination ?? fallbackPagination,
    }
  }
}
