import type { BackofficeAllUsersUpdateUserTypeInput, IBackofficeAllUsersService } from "./IBackofficeAllUsersService"
import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
  BackofficeAllUsersScheduleFilters,
  BackofficeAllUsersScheduleListResult,
  BackofficeAllUsersEmailDispatchFilters,
  BackofficeAllUsersEmailDispatchListResult,
  BackofficeAllUsersUserType,
  BackofficeSponsorMasterOption,
} from "../context/BackofficeAllUsersTypes"

interface OutputResponse<T> {
  isValid: boolean
  successMessages?: string[]
  errorMessages?: string[]
  result?: T
}

const ERROR_MESSAGE_BY_STATUS: Record<number, string> = {
  401: "Sessão expirada. Faça login novamente.",
  403: "Você não tem permissão para esta ação.",
  404: "Recurso não encontrado.",
  500: "Erro interno do servidor. Tente novamente.",
}

async function parseOutput<T>(response: Response, fallbackMessage: string): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false

  if (!isJson) {
    throw new Error(ERROR_MESSAGE_BY_STATUS[response.status] ?? fallbackMessage)
  }

  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? fallbackMessage)
  }
  return data.result
}

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

    const userType = params?.filters?.userType
    if (userType && userType !== "all") search.set("userType", userType)

    const result = await parseOutput<{
      items?: BackofficeAllUsersListResult["items"]
      pagination?: BackofficeAllUsersListResult["pagination"]
    }>(
      await fetch(`/api/v1/backoffice/clients/all-users?${search.toString()}`, { cache: "no-store" }),
      "Erro ao carregar usuários"
    )

    const fallbackPagination = {
      page,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    }

    return {
      items: result.items ?? [],
      pagination: result.pagination ?? fallbackPagination,
    }
  }

  async getDetail(profileId: string): Promise<BackofficeAllUsersDetail> {
    return parseOutput<BackofficeAllUsersDetail>(
      await fetch(`/api/v1/backoffice/clients/all-users/${profileId}`, { cache: "no-store" }),
      "Erro ao carregar detalhes do usuário"
    )
  }

  async getSchedules(
    profileId: string,
    params?: {
      filters?: Partial<BackofficeAllUsersScheduleFilters>
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeAllUsersScheduleListResult> {
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 10, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    const query = params?.filters?.query?.trim()
    if (query) search.set("q", query)

    for (const fn of params?.filters?.functions ?? []) {
      if (fn) search.append("function", fn)
    }

    for (const status of params?.filters?.meetingStatuses ?? []) {
      if (status) search.append("meetingStatus", status)
    }

    for (const status of params?.filters?.leadStatuses ?? []) {
      if (status) search.append("leadStatus", status)
    }

    if (params?.filters?.dateFrom) search.set("dateFrom", params.filters.dateFrom)
    if (params?.filters?.dateTo) search.set("dateTo", params.filters.dateTo)

    const result = await parseOutput<{
      items?: BackofficeAllUsersScheduleListResult["items"]
      pagination?: BackofficeAllUsersScheduleListResult["pagination"]
    }>(
      await fetch(
        `/api/v1/backoffice/clients/all-users/${profileId}/schedules?${search.toString()}`,
        { cache: "no-store" }
      ),
      "Erro ao carregar agendamentos do usuário"
    )

    const fallbackPagination = {
      page,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    }

    return {
      items: result.items ?? [],
      pagination: result.pagination ?? fallbackPagination,
    }
  }

  async getEmailDispatches(
    profileId: string,
    params?: {
      filters?: Partial<BackofficeAllUsersEmailDispatchFilters>
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeAllUsersEmailDispatchListResult> {
    const page = Math.max(params?.page ?? 1, 1)
    const pageSize = Math.max(params?.pageSize ?? 10, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    const query = params?.filters?.query?.trim()
    if (query) search.set("q", query)

    for (const status of params?.filters?.statuses ?? []) {
      if (status) search.append("status", status)
    }

    for (const provider of params?.filters?.providers ?? []) {
      if (provider) search.append("provider", provider)
    }

    for (const category of params?.filters?.categories ?? []) {
      if (category) search.append("category", category)
    }

    if (params?.filters?.dateFrom) search.set("dateFrom", params.filters.dateFrom)
    if (params?.filters?.dateTo) search.set("dateTo", params.filters.dateTo)

    const result = await parseOutput<{
      items?: BackofficeAllUsersEmailDispatchListResult["items"]
      pagination?: BackofficeAllUsersEmailDispatchListResult["pagination"]
    }>(
      await fetch(
        `/api/v1/backoffice/clients/all-users/${profileId}/email-dispatches?${search.toString()}`,
        { cache: "no-store" }
      ),
      "Erro ao carregar e-mails disparados do usuário"
    )

    const fallbackPagination = {
      page,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    }

    return {
      items: result.items ?? [],
      pagination: result.pagination ?? fallbackPagination,
    }
  }

  async sendAccessEmail(
    memberId: string,
    mode: "invite" | "reset_password"
  ): Promise<{ email: string }> {
    return parseOutput<{ email: string }>(
      await fetch(`/api/v1/backoffice/members/${memberId}/access-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      }),
      "Erro ao enviar e-mail de acesso"
    )
  }

  async updateUserType(
    profileId: string,
    payload: BackofficeAllUsersUpdateUserTypeInput
  ): Promise<BackofficeAllUsersUserType> {
    const result = await parseOutput<{ userType: BackofficeAllUsersUserType }>(
      await fetch(`/api/v1/backoffice/clients/all-users/${profileId}/user-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      "Erro ao atualizar tipo de usuário"
    )
    return result.userType
  }

  async listSponsorMasters(): Promise<BackofficeSponsorMasterOption[]> {
    const result = await parseOutput<{ options: BackofficeSponsorMasterOption[] }>(
      await fetch("/api/v1/backoffice/clients/all-users/sponsor-masters"),
      "Erro ao carregar patrocinadores"
    )
    return result.options
  }
}
