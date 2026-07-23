import type {
  BackofficeWhatsAppInstanceDetail,
  BackofficeWhatsAppInstanceListItem,
  BackofficeWhatsAppInstancesFilters,
  BackofficeWhatsAppInstancesPagination,
  BackofficeWhatsAppTeamWithoutInstance,
  ProvisionWhatsAppInstanceFormData,
  UpdateWhatsAppInstanceFormData,
} from "../context/BackofficeWhatsAppInstancesTypes"
import type {
  ApiOutput,
  IBackofficeWhatsAppInstancesService,
} from "./IBackofficeWhatsAppInstancesService"

export class BackofficeWhatsAppInstancesService implements IBackofficeWhatsAppInstancesService {
  async list(
    filters: BackofficeWhatsAppInstancesFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppInstanceListItem[]; pagination: BackofficeWhatsAppInstancesPagination }> {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    })
    if (filters.q.trim()) params.set("q", filters.q.trim())
    if (filters.status !== "all") params.set("status", filters.status)

    const res = await fetch(`/api/v1/backoffice/whatsapp/instances?${params.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar instâncias WhatsApp")
    }
    return data.result
  }

  async getDetail(configId: string): Promise<BackofficeWhatsAppInstanceDetail> {
    const res = await fetch(`/api/v1/backoffice/whatsapp/instances/${configId}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar instância")
    }
    return data.result
  }

  async update(
    configId: string,
    form: UpdateWhatsAppInstanceFormData
  ): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>> {
    const res = await fetch(`/api/v1/backoffice/whatsapp/instances/${configId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usageLimitMonthly: form.usageLimitMonthly,
        billingEnabled: form.billingEnabled,
      }),
    })
    return res.json()
  }

  async provision(
    form: ProvisionWhatsAppInstanceFormData
  ): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>> {
    const res = await fetch("/api/v1/backoffice/whatsapp/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: form.teamId,
        usageLimitMonthly: form.usageLimitMonthly,
      }),
    })
    return res.json()
  }

  async reconnect(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>> {
    const res = await fetch(`/api/v1/backoffice/whatsapp/instances/${configId}/reconnect`, {
      method: "POST",
    })
    return res.json()
  }

  async disconnect(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>> {
    const res = await fetch(`/api/v1/backoffice/whatsapp/instances/${configId}/disconnect`, {
      method: "POST",
    })
    return res.json()
  }

  async syncHistory(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>> {
    const res = await fetch(`/api/v1/backoffice/whatsapp/instances/${configId}/sync-history`, {
      method: "POST",
    })
    return res.json()
  }

  async listTeamsWithoutInstance(q?: string): Promise<BackofficeWhatsAppTeamWithoutInstance[]> {
    const params = new URLSearchParams({ page: "1", pageSize: "50" })
    if (q?.trim()) params.set("q", q.trim())

    const res = await fetch(
      `/api/v1/backoffice/whatsapp/teams-without-instance?${params.toString()}`,
      { cache: "no-store" }
    )
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar times elegíveis")
    }
    return data.result?.items ?? []
  }
}
