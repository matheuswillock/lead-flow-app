import type {
  BackofficeStudioBotAuthChallengeFilters,
  BackofficeStudioBotChannel,
  BackofficeStudioBotChannelFormData,
  BackofficeStudioBotConversationsFilters,
  BackofficeStudioBotProfileFormData,
  BackofficeStudioBotQrCode,
} from "../context/BackofficeStudioBotTypes"
import type { ApiOutput, IBackofficeStudioBotService } from "./IBackofficeStudioBotService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeStudioBotService implements IBackofficeStudioBotService {
  async getChannel() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar canal")
    }
    return data.result?.channel ?? null
  }

  async updateChannel(form: BackofficeStudioBotChannelFormData) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    return res.json() as Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  }

  async updateChannelProfile(form: BackofficeStudioBotProfileFormData) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        aboutText: form.aboutText.trim() || null,
      }),
    })
    return res.json() as Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  }

  async testPing() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/test-ping`, { method: "POST" })
    return res.json() as Promise<ApiOutput<{ status: number; ok: boolean }>>
  }

  async uploadChannelAvatar(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/avatar`, {
      method: "POST",
      body: formData,
    })
    return res.json() as Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  }

  async reconnectChannel() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/reconnect`, { method: "POST" })
    return res.json() as Promise<
      ApiOutput<{ channel: BackofficeStudioBotChannel; qrCode: BackofficeStudioBotQrCode | null }>
    >
  }

  async refreshChannelConnection() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/refresh-connection`, { method: "POST" })
    return res.json() as Promise<
      ApiOutput<{
        channel: BackofficeStudioBotChannel
        evoStatus: "open" | "close" | "connecting"
        connected: boolean
      }>
    >
  }

  async disconnectChannel() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/disconnect`, { method: "POST" })
    return res.json() as Promise<ApiOutput<{ channel: BackofficeStudioBotChannel }>>
  }

  async syncChannelProfile() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/channel/sync-profile`, { method: "POST" })
    return res.json() as Promise<ApiOutput<{ ok: boolean; status: number }>>
  }

  async listConversations(
    filters: BackofficeStudioBotConversationsFilters,
    pagination: { page: number; pageSize: number }
  ) {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    })
    if (filters.search.trim()) params.set("search", filters.search.trim())

    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/conversations?${params.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar conversas")
    }
    return data.result
  }

  async listMessages(userLinkId: string, pagination?: { before?: string; limit?: number }) {
    const params = new URLSearchParams()
    if (pagination?.before) params.set("before", pagination.before)
    if (pagination?.limit) params.set("limit", String(pagination.limit))

    const query = params.toString()
    const res = await fetch(
      `${API_CLIENT_BASE}/backoffice/bot/conversations/${encodeURIComponent(userLinkId)}/messages${query ? `?${query}` : ""}`,
      { cache: "no-store" }
    )
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar mensagens")
    }
    return data.result
  }

  async listUserLinks(pagination: { page: number; pageSize: number }) {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    })
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/user-links?${params.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar vínculos")
    }
    return data.result
  }

  async revokeUserLink(userLinkId: string) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/user-links/${encodeURIComponent(userLinkId)}`, {
      method: "DELETE",
    })
    return res.json() as Promise<ApiOutput<{ userLinkId: string }>>
  }

  async listAuthChallenges(
    filters: BackofficeStudioBotAuthChallengeFilters,
    pagination: { page: number; pageSize: number }
  ) {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    })
    if (filters.source !== "all") params.set("source", filters.source)
    if (filters.status !== "all") params.set("status", filters.status)

    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/auth-challenges?${params.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar verificações")
    }
    return data.result
  }
}
