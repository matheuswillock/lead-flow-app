import type {
  Campaign,
  CampaignEmailLog,
  CampaignLogDetail,
  ContactList,
  CreditStatus,
  Template,
} from "@/app/[supabaseId]/email/campanhas/features/context/CampanhasTypes"
import type {
  StudioEmailCampanhasService,
  StudioEmailCreateCampaignData,
  StudioEmailListCampaignsResult,
  StudioEmailSendResult,
  StudioEmailUpdateCampaignData,
} from "@/lib/email/studio-email-service-contracts"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeCampanhasService implements StudioEmailCampanhasService {
  private path(supabaseId: string, teamId: string | null | undefined, suffix = ""): string {
    if (!teamId) throw new Error("teamId é obrigatório")
    return `${studioEmailBasePath(supabaseId, teamId)}/campaigns${suffix}`
  }

  async list(
    supabaseId: string,
    teamId: string | null | undefined,
    page: number,
    pageSize: number,
    status?: string[],
    name?: string,
    createdAtFrom?: string,
    createdAtTo?: string
  ): Promise<StudioEmailListCampaignsResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status && status.length > 0) params.set("status", status.join(","))
    if (name) params.set("name", name)
    if (createdAtFrom) params.set("createdAtFrom", createdAtFrom)
    if (createdAtTo) params.set("createdAtTo", createdAtTo)
    const qs = params.toString()
    const response = await fetch(`${this.path(supabaseId, teamId)}${qs ? `?${qs}` : ""}`)
    const result = await parseStudioEmailOutput<{
      campaigns: Campaign[]
      total: number
      page?: number
      pageSize?: number
      totalPages?: number
    }>(response)
    return {
      campaigns: result.campaigns,
      total: result.total,
      page: result.page ?? page,
      pageSize: result.pageSize ?? pageSize,
      totalPages: result.totalPages ?? Math.max(1, Math.ceil(result.total / pageSize)),
    }
  }

  async create(
    supabaseId: string,
    teamId: string | null | undefined,
    data: StudioEmailCreateCampaignData
  ): Promise<Campaign> {
    const response = await fetch(this.path(supabaseId, teamId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<Campaign>(response)
  }

  async getById(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string
  ): Promise<Campaign> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}`)
    return parseStudioEmailOutput<Campaign>(response)
  }

  async update(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string,
    data: StudioEmailUpdateCampaignData
  ): Promise<Campaign> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<Campaign>(response)
  }

  async send(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string
  ): Promise<StudioEmailSendResult> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}/send`, {
      method: "POST",
    })
    return parseStudioEmailOutput<StudioEmailSendResult>(response)
  }

  async cancel(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}/cancel`, {
      method: "POST",
    })
    await parseStudioEmailOutput<unknown>(response)
  }

  async deleteDraft(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string
  ): Promise<void> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      await parseStudioEmailOutput<unknown>(response)
    }
  }

  async archive(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void> {
    const response = await fetch(`${this.path(supabaseId, teamId)}/${id}/archive`, {
      method: "POST",
    })
    await parseStudioEmailOutput<unknown>(response)
  }

  async getCreditStatus(
    _supabaseId: string,
    _teamId: string | null | undefined
  ): Promise<CreditStatus> {
    return {
      hasSubscription: true,
      isBetaExempt: true,
      plan: null,
      monthlyCredits: 999_999,
      creditsUsed: 0,
      creditsAvailable: 999_999,
      currentPeriodEnd: null,
    }
  }

  async getTemplates(
    supabaseId: string,
    teamId: string | null | undefined
  ): Promise<Template[]> {
    const base = studioEmailBasePath(supabaseId, teamId!)
    const response = await fetch(`${base}/templates?scope=campaign`)
    const templates = await parseStudioEmailOutput<Template[]>(response)
    return templates.filter((t) => t.status === "published" && t.isCurrentPublished)
  }

  async getContactLists(
    supabaseId: string,
    teamId: string | null | undefined
  ): Promise<ContactList[]> {
    const base = studioEmailBasePath(supabaseId, teamId!)
    const response = await fetch(`${base}/contact-lists`)
    return parseStudioEmailOutput<ContactList[]>(response)
  }

  async getCampaignLogs(
    supabaseId: string,
    teamId: string | null | undefined,
    campaignId: string,
    params: { page: number; pageSize: number; search?: string; status?: string[] }
  ): Promise<{
    logs: CampaignEmailLog[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const base = studioEmailBasePath(supabaseId, teamId!)
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      campaignId,
    })
    if (params.search) query.set("search", params.search)
    if (params.status && params.status.length > 0) query.set("status", params.status.join(","))
    const response = await fetch(`${base}/logs?${query}`)
    return parseStudioEmailOutput(response)
  }

  async getCampaignLogDetail(
    supabaseId: string,
    teamId: string | null | undefined,
    logId: string
  ): Promise<CampaignLogDetail> {
    const base = studioEmailBasePath(supabaseId, teamId!)
    const response = await fetch(`${base}/logs/${logId}`)
    return parseStudioEmailOutput<CampaignLogDetail>(response)
  }
}
