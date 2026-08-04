import type { IBackofficeClientDetailsService, BackofficeMutationResult } from "./IBackofficeClientDetailsService"
import type {
  BackofficeClientDetails,
  BackofficeClientInvoiceFilters,
  BackofficeClientInvoicesResult,
} from "../context/BackofficeClientDetailsTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

function mapMutationResult(result: unknown): BackofficeMutationResult {
  if (
    result &&
    typeof result === "object" &&
    "requiresPayment" in result &&
    (result as { requiresPayment?: boolean }).requiresPayment === true &&
    "checkoutUrl" in result &&
    typeof (result as { checkoutUrl?: unknown }).checkoutUrl === "string" &&
    "pendingActionId" in result &&
    typeof (result as { pendingActionId?: unknown }).pendingActionId === "string"
  ) {
    const pending = result as unknown as {
      pendingActionId: string
      checkoutUrl: string
      totalCharge: number
      remainingMonths: number
    }
    return {
      kind: "pending_payment",
      requiresPayment: true,
      pendingActionId: pending.pendingActionId,
      checkoutUrl: pending.checkoutUrl,
      totalCharge: pending.totalCharge,
      remainingMonths: pending.remainingMonths,
    }
  }

  return { kind: "completed" }
}

export class BackofficeClientDetailsService implements IBackofficeClientDetailsService {
  async sendAccessEmail(
    memberId: string,
    mode: "invite" | "reset_password"
  ): Promise<{ email: string }> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/members/${memberId}/access-email`, {
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

    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}?${search.toString()}`, {
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
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/invoices?${search.toString()}`,
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
      hasUnlimitedUsers?: boolean
      multiskillEnabled?: boolean
    }
  ): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar dados do cliente")
    }
  }

  async updateUserType(
    masterId: string,
    data: {
      userType: "common" | "member_pro"
      accessExpiresAt?: string
    }
  ): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/clients/all-users/${masterId}/user-type`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar tipo de usuário")
    }
  }

  async banUser(profileId: string, reason?: string | null): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/anatemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, reason }),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao banir usuário")
    }
  }

  async deleteClient(masterId: string): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}`, {
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
      canViewAllTeams?: boolean
      teamId?: string
      accountMasterId?: string
    }
  ): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/members/${memberId}`, {
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
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/members/${memberId}`, {
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
      `${API_CLIENT_BASE}/backoffice/members/${memberId}/teams/${teamId}`,
      { method: "DELETE" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao remover membro do time")
    }
  }

  async addMemberToTeam(
    memberId: string,
    teamId: string,
    access?: {
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      canCreateAccountUsers: boolean
      canManageAccountTeams: boolean
      canTransferAccountLeads: boolean
      canViewAllTeams: boolean
    }
  ): Promise<void> {
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/members/${memberId}/teams/${teamId}`,
      {
        method: "POST",
        headers: access ? { "Content-Type": "application/json" } : undefined,
        body: access ? JSON.stringify(access) : undefined,
      }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao adicionar membro ao time")
    }
  }

  async getMemberGoogleScopes(memberId: string): Promise<{ connected: boolean; scopes: string[] }> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/members/${memberId}/google-scopes`, {
      cache: "no-store",
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao buscar escopos Google do membro")
    }
    return json.result as { connected: boolean; scopes: string[] }
  }

  async getMemberExternalTeams(memberId: string, accountMasterId: string) {
    const params = new URLSearchParams({ accountMasterId })
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/members/${memberId}/external-teams?${params.toString()}`,
      { cache: "no-store" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao listar times externos do membro")
    }
    return (json.result?.items ?? []) as Array<{
      teamId: string
      teamName: string
      accountMasterId: string
      accountName: string
      role: string
    }>
  }

  async getMemberAccountTeams(memberId: string, accountMasterId: string) {
    const params = new URLSearchParams({ accountMasterId })
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/members/${memberId}/account-teams?${params.toString()}`,
      { cache: "no-store" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao listar times da conta")
    }
    return (json.result?.items ?? []) as Array<{
      teamId: string
      teamName: string
      membersCount: number
      isMember: boolean
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
    }>
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
      generateCharge?: boolean
    }
  ): Promise<BackofficeMutationResult> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao adicionar usuário")
    }
    return mapMutationResult(json.result)
  }

  async addTeam(
    masterId: string,
    data: { name: string; generateCharge?: boolean }
  ): Promise<BackofficeMutationResult> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao criar time")
    }
    return mapMutationResult(json.result)
  }

  async addMasterToTeam(masterId: string, teamId: string): Promise<void> {
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams/${teamId}/add-master`,
      { method: "POST" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao adicionar master ao time")
    }
  }

  async updateTeam(
    masterId: string,
    teamId: string,
    data: { name?: string; transferTargetTeamIds?: string[] }
  ): Promise<void> {
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams/${teamId}`,
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
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams/${teamId}`,
      { method: "DELETE" }
    )
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao excluir time")
    }
  }
}
