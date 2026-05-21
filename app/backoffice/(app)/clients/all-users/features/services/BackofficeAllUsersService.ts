import type { IBackofficeAllUsersService } from "./IBackofficeAllUsersService"
import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
} from "../context/BackofficeAllUsersTypes"

export class BackofficeAllUsersService implements IBackofficeAllUsersService {
  async list(params?: {
    filters?: Partial<BackofficeAllUsersFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAllUsersListResult> {
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 10, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    const query = params?.filters?.query?.trim()
    if (query) search.set("q", query)

    const role = params?.filters?.role
    if (role && role !== "all") search.set("role", role)

    const plan = params?.filters?.plan
    if (plan && plan !== "all") search.set("plan", plan)

    const res = await fetch(`/api/v1/backoffice/clients/all-users?${search.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar usuários")
    }

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

  async getDetail(profileId: string): Promise<BackofficeAllUsersDetail> {
    const res = await fetch(`/api/v1/backoffice/clients/all-users/${profileId}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar detalhes do usuário")
    }
    return data.result as BackofficeAllUsersDetail
  }
}
