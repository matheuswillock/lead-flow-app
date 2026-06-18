import type { IBackofficeClientDetailsService } from "./IBackofficeClientDetailsService"
import type {
  BackofficeClientDetails,
  BackofficeClientInvoiceFilters,
  BackofficeClientInvoicesResult,
} from "../context/BackofficeClientDetailsTypes"

export class BackofficeClientDetailsService implements IBackofficeClientDetailsService {
  async sendAccessEmail(
    memberId: string,
    mode: "invite" | "reset_password"
  ): Promise<{ email: string }> {
    const res = await fetch(`/api/v1/backoffice/members/${memberId}/access-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
    const json = await res.json()
    if (!json.isValid || !json.result) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao enviar e-mail de acesso")
    }
    return json.result as { email: string }
  }

  async getByMasterId(
    masterId: string,
    options?: {
      query?: string
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeClientDetails> {
    const page = Math.max(options?.page ?? 1, 1)
    const pageSize = Math.max(options?.pageSize ?? 10, 5)
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    if (options?.query?.trim()) {
      search.set("q", options.query.trim())
    }

    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}?${search.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()

    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar detalhes do usuário")
    }

    return data.result
  }

  async getInvoicesByMasterId(
    masterId: string,
    options?: {
      page?: number
      pageSize?: number
      status?: BackofficeClientInvoiceFilters["status"]
      period?: BackofficeClientInvoiceFilters["period"]
      timezone?: string
    }
  ): Promise<BackofficeClientInvoicesResult> {
    const page = Math.max(options?.page ?? 1, 1)
    const pageSize = Math.max(options?.pageSize ?? 10, 5)

    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })

    if (options?.status && options.status !== "all") {
      search.set("status", options.status)
    }

    if (options?.period && options.period !== "all") {
      search.set("period", options.period)
    }

    if (options?.timezone?.trim()) {
      search.set("timezone", options.timezone.trim())
    }

    const res = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/invoices?${search.toString()}`,
      { cache: "no-store" }
    )
    const data = await res.json()

    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar faturas do usuário")
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
      items: data.result.items ?? [],
      pagination: data.result.pagination ?? fallbackPagination,
      summary: data.result.summary ?? {
        charged: 0,
        upcoming: 0,
        overdue: 0,
      },
      filters: data.result.filters ?? {
        status: "all",
        period: "all",
      },
    }
  }

  async updateClient(
    masterId: string,
    data: {
      fullName?: string
      phone?: string | null
      cpfCnpj?: string | null
      postalCode?: string | null
      address?: string | null
      addressNumber?: string | null
      neighborhood?: string | null
      complement?: string | null
      city?: string | null
      state?: string | null
      functions?: string[]
      hasPermanentSubscription?: boolean
    }
  ): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar dados do cliente")
    }
  }

  async deleteClient(masterId: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}`, {
      method: "DELETE",
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao excluir conta do cliente")
    }
  }

  async updateMember(
    memberId: string,
    data: {
      fullName?: string
      phone?: string | null
      email?: string
      role?: "manager" | "backoffice" | "operator"
      functions?: ("SDR" | "CLOSER")[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      teamId?: string
    }
  ): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar membro")
    }
  }

  async deleteMember(memberId: string, password: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/members/${memberId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao excluir conta do membro")
    }
  }

  async removeMemberFromTeam(memberId: string, teamId: string): Promise<void> {
    const res = await fetch(
      `/api/v1/backoffice/members/${memberId}/teams/${teamId}`,
      { method: "DELETE" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao remover membro do time")
    }
  }

  async getMemberGoogleScopes(memberId: string): Promise<{ connected: boolean; scopes: string[] }> {
    const res = await fetch(`/api/v1/backoffice/members/${memberId}/google-scopes`, {
      cache: "no-store",
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao buscar escopos Google do membro")
    }
    return json.result as { connected: boolean; scopes: string[] }
  }

  async addMember(
    masterId: string,
    data: {
      fullName: string
      email: string
      phone?: string | null
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      teamId: string
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
    }
  ): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao adicionar usuário")
    }
  }

  async addTeam(masterId: string, data: { name: string }): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao criar time")
    }
  }

  async updateTeam(
    masterId: string,
    teamId: string,
    data: { name?: string; transferTargetTeamIds?: string[] }
  ): Promise<void> {
    const res = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar time")
    }
  }

  async deleteTeam(masterId: string, teamId: string): Promise<void> {
    const res = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}`,
      { method: "DELETE" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao excluir time")
    }
  }
}
