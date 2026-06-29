import type { ICdpService, CdpFieldOption, ListProfilesParams } from "./ICdpService"
import type {
  CdpMetrics,
  CdpProfileDetail,
  CdpProfileListItem,
  CdpSegment,
  CdpSyncResult,
} from "../context/CdpTypes"

async function parseOutput<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro na requisição")
  return json.result as T
}

export class CdpService implements ICdpService {
  private readonly baseUrl = "/api/v1/cdp"

  private buildHeaders(supabaseId: string, teamId: string): HeadersInit {
    return {
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }
  }

  async syncCrm(
    supabaseId: string,
    teamId: string,
    body?: { leadId?: string }
  ): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/crm`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncPortfolio(supabaseId: string, teamId: string): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/portfolio`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncEmail(supabaseId: string, teamId: string): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/email`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncWhatsapp(supabaseId: string, teamId: string): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/whatsapp`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<CdpSyncResult>(res)
  }

  async listProfiles(supabaseId: string, teamId: string, params: ListProfilesParams) {
    const headers = this.buildHeaders(supabaseId, teamId)

    if (params.segment) {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      })
      const res = await fetch(`${this.baseUrl}/segments/${params.segment}/profiles?${query}`, {
        cache: "no-store",
        headers,
      })
      const result = await parseOutput<{
        items: CdpProfileDetail[]
        total: number
        page: number
        pageSize: number
      }>(res)
      return {
        items: result.items as CdpProfileListItem[],
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }
    }

    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    })
    if (params.search) query.set("search", params.search)
    if (params.consent) query.set("consent", params.consent)
    if (params.sourceType) query.set("sourceType", params.sourceType)
    if (params.channel) query.set("channel", params.channel)
    if (params.lastSeenFrom) query.set("lastSeenFrom", params.lastSeenFrom)
    if (params.lastSeenTo) query.set("lastSeenTo", params.lastSeenTo)

    const res = await fetch(`${this.baseUrl}/profiles?${query}`, {
      cache: "no-store",
      headers,
    })
    return parseOutput<{
      items: CdpProfileListItem[]
      total: number
      page: number
      pageSize: number
    }>(res)
  }

  async getProfile(supabaseId: string, teamId: string, id: string): Promise<CdpProfileDetail> {
    const res = await fetch(`${this.baseUrl}/profiles/${id}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<CdpProfileDetail>(res)
  }

  async listSegments(
    supabaseId: string,
    teamId: string
  ): Promise<{ segments: CdpSegment[]; metrics: CdpMetrics }> {
    const res = await fetch(`${this.baseUrl}/segments`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ segments: CdpSegment[]; metrics: CdpMetrics }>(res)
  }

  async listSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segment: string,
    page: number,
    pageSize: number
  ) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${this.baseUrl}/segments/${segment}/profiles?${query}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ items: CdpProfileDetail[]; total: number }>(res)
  }

  async listProfileEvents(
    supabaseId: string,
    teamId: string,
    profileId: string,
    page: number,
    pageSize: number
  ) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${this.baseUrl}/profiles/${profileId}/events?${query}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ items: CdpProfileDetail["events"]; total: number }>(res)
  }

  async listAvailableFields(supabaseId: string, teamId: string): Promise<CdpFieldOption[]> {
    const res = await fetch(`${this.baseUrl}/available-fields`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const result = await parseOutput<{ fields?: CdpFieldOption[] }>(res)
    return result.fields ?? []
  }

  async previewInterpolation(
    supabaseId: string,
    teamId: string,
    body: { profileId: string; variableKeys: string[] }
  ): Promise<{ values: Record<string, string> }> {
    const res = await fetch(`${this.baseUrl}/interpolation-preview`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    return parseOutput<{ values: Record<string, string> }>(res)
  }
}

export const cdpService = new CdpService()
