import type { IRadarService, RadarFieldOption, ListProfilesParams } from "./IRadarService"
import type {
  RadarMetrics,
  RadarProfileDetail,
  RadarProfileListItem,
  RadarSegment,
  RadarSyncResult,
} from "../context/RadarTypes"

async function parseOutput<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro na requisição")
  return json.result as T
}

export class RadarFrontendService implements IRadarService {
  private readonly baseUrl = "/api/v1/radar"

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
  ): Promise<RadarSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/crm`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    })
    return parseOutput<RadarSyncResult>(res)
  }

  async syncPortfolio(supabaseId: string, teamId: string): Promise<RadarSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/portfolio`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarSyncResult>(res)
  }

  async syncEmail(supabaseId: string, teamId: string): Promise<RadarSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/email`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarSyncResult>(res)
  }

  async syncWhatsapp(supabaseId: string, teamId: string): Promise<RadarSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/whatsapp`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarSyncResult>(res)
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
        items: RadarProfileDetail[]
        total: number
        page: number
        pageSize: number
      }>(res)
      return {
        items: result.items as RadarProfileListItem[],
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
      items: RadarProfileListItem[]
      total: number
      page: number
      pageSize: number
    }>(res)
  }

  async getProfile(supabaseId: string, teamId: string, id: string): Promise<RadarProfileDetail> {
    const res = await fetch(`${this.baseUrl}/profiles/${id}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarProfileDetail>(res)
  }

  async listSegments(
    supabaseId: string,
    teamId: string
  ): Promise<{ segments: RadarSegment[]; metrics: RadarMetrics }> {
    const res = await fetch(`${this.baseUrl}/segments`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ segments: RadarSegment[]; metrics: RadarMetrics }>(res)
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
    return parseOutput<{ items: RadarProfileDetail[]; total: number }>(res)
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
    return parseOutput<{ items: RadarProfileDetail["events"]; total: number }>(res)
  }

  async listAvailableFields(supabaseId: string, teamId: string): Promise<RadarFieldOption[]> {
    const res = await fetch(`${this.baseUrl}/available-fields`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const result = await parseOutput<{ fields?: RadarFieldOption[] }>(res)
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

export const radarFrontendService = new RadarFrontendService()
