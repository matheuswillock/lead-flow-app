import type {
  IBackofficeStudioEmailService,
  StudioEmailAnalytics,
  StudioEmailCampaign,
  StudioEmailContactList,
  StudioEmailLog,
  StudioEmailTemplate,
} from "./IBackofficeStudioEmailService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

function basePath(masterId: string, teamId: string) {
  return `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams/${teamId}/email`
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

export class BackofficeStudioEmailService implements IBackofficeStudioEmailService {
  async listCampaigns(
    masterId: string,
    teamId: string,
    params?: { page?: number; pageSize?: number; name?: string }
  ): Promise<{ campaigns: StudioEmailCampaign[]; total: number }> {
    const search = new URLSearchParams()
    if (params?.page) search.set("page", String(params.page))
    if (params?.pageSize) search.set("pageSize", String(params.pageSize))
    if (params?.name) search.set("name", params.name)
    const qs = search.toString()
    const response = await fetch(
      `${basePath(masterId, teamId)}/campaigns${qs ? `?${qs}` : ""}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async createCampaign(
    masterId: string,
    teamId: string,
    data: {
      name: string
      templateId: string
      contactListId?: string
      radarSegmentSlug?: string
      scheduledAt?: string | null
    }
  ): Promise<StudioEmailCampaign> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async sendCampaign(masterId: string, teamId: string, campaignId: string): Promise<void> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/campaigns/${campaignId}/send`,
      { method: "POST" }
    )
    await parseOutput(response)
  }

  async cancelCampaign(masterId: string, teamId: string, campaignId: string): Promise<void> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/campaigns/${campaignId}/cancel`,
      { method: "POST" }
    )
    await parseOutput(response)
  }

  async archiveCampaign(masterId: string, teamId: string, campaignId: string): Promise<void> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/campaigns/${campaignId}/archive`,
      { method: "POST" }
    )
    await parseOutput(response)
  }

  async listContactLists(masterId: string, teamId: string): Promise<StudioEmailContactList[]> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createContactList(
    masterId: string,
    teamId: string,
    data: { name: string; description?: string }
  ): Promise<StudioEmailContactList> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async deleteContactList(masterId: string, teamId: string, listId: string): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}`, {
      method: "DELETE",
    })
    await parseOutput(response)
  }

  async listTemplates(masterId: string, teamId: string): Promise<StudioEmailTemplate[]> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createTemplate(
    masterId: string,
    teamId: string,
    data: { name: string; subject: string; html?: string }
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async getAnalytics(masterId: string, teamId: string): Promise<StudioEmailAnalytics> {
    const response = await fetch(`${basePath(masterId, teamId)}/analytics`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async listLogs(
    masterId: string,
    teamId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<{ items: StudioEmailLog[]; total: number }> {
    const search = new URLSearchParams()
    if (params?.page) search.set("page", String(params.page))
    if (params?.pageSize) search.set("pageSize", String(params.pageSize))
    const qs = search.toString()
    const response = await fetch(
      `${basePath(masterId, teamId)}/logs${qs ? `?${qs}` : ""}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getSettings(masterId: string, teamId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }
}

export const backofficeStudioEmailService = new BackofficeStudioEmailService()
