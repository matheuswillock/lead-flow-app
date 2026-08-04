import type {
  IRadarService,
  RadarFieldOption,
  ListProfilesParams,
  ExportProfilesParams,
  RadarExportResult,
  CustomSegmentInput,
  CustomSegmentUpdateInput,
} from "./IRadarService"
import type {
  RadarCustomSegment,
  RadarCustomSegmentListItem,
  RadarMetrics,
  RadarProfileDetail,
  RadarProfileListItem,
  RadarProfileContracts,
  RadarProfileTouchpoints,
  RadarSegment,
  RadarSegmentDeleteResult,
  RadarSegmentRules,
  RadarSyncResult,
} from "../context/RadarTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

async function parseOutput<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro na requisição")
  return json.result as T
}

export class RadarFrontendService implements IRadarService {
  private readonly baseUrl = `${API_CLIENT_BASE}/radar`

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

  async exportProfiles(
    supabaseId: string,
    teamId: string,
    params: ExportProfilesParams
  ): Promise<RadarExportResult> {
    const query = new URLSearchParams()
    if (params.search) query.set("search", params.search)
    if (params.consent) query.set("consent", params.consent)
    if (params.sourceType) query.set("sourceType", params.sourceType)
    if (params.channel) query.set("channel", params.channel)
    if (params.lastSeenFrom) query.set("lastSeenFrom", params.lastSeenFrom)
    if (params.lastSeenTo) query.set("lastSeenTo", params.lastSeenTo)

    const qs = query.toString()
    const res = await fetch(`${this.baseUrl}/profiles/export${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarExportResult>(res)
  }

  async exportSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segment: string
  ): Promise<RadarExportResult> {
    const res = await fetch(`${this.baseUrl}/segments/${encodeURIComponent(segment)}/export`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarExportResult>(res)
  }

  async exportCustomSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segmentId: string
  ): Promise<RadarExportResult> {
    const res = await fetch(`${this.baseUrl}/segments/custom/${segmentId}/export`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarExportResult>(res)
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

  async listAvailableEventTypes(supabaseId: string, teamId: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/available-event-types`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const result = await parseOutput<{ eventTypes?: string[] }>(res)
    return result.eventTypes ?? []
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

  async listCustomSegments(supabaseId: string, teamId: string): Promise<RadarCustomSegmentListItem[]> {
    const res = await fetch(`${this.baseUrl}/segments/custom`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarCustomSegmentListItem[]>(res)
  }

  async createCustomSegment(
    supabaseId: string,
    teamId: string,
    input: CustomSegmentInput
  ): Promise<RadarCustomSegment> {
    const res = await fetch(`${this.baseUrl}/segments/custom`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })
    return parseOutput<RadarCustomSegment>(res)
  }

  async updateCustomSegment(
    supabaseId: string,
    teamId: string,
    segmentId: string,
    input: CustomSegmentUpdateInput
  ): Promise<RadarCustomSegment> {
    const res = await fetch(`${this.baseUrl}/segments/custom/${segmentId}`, {
      method: "PATCH",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })
    return parseOutput<RadarCustomSegment>(res)
  }

  async deleteCustomSegment(
    supabaseId: string,
    teamId: string,
    segmentId: string
  ): Promise<RadarSegmentDeleteResult> {
    const res = await fetch(`${this.baseUrl}/segments/custom/${segmentId}`, {
      method: "DELETE",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarSegmentDeleteResult>(res)
  }

  async listCustomSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segmentId: string,
    page: number,
    pageSize: number
  ) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${this.baseUrl}/segments/custom/${segmentId}/profiles?${query}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ items: RadarProfileDetail[]; total: number; page: number; pageSize: number }>(res)
  }

  async previewCustomSegmentCount(
    supabaseId: string,
    teamId: string,
    rules: RadarSegmentRules
  ): Promise<{ count: number }> {
    const res = await fetch(`${this.baseUrl}/segments/custom/preview`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rules }),
    })
    return parseOutput<{ count: number }>(res)
  }

  async getProfileTouchpoints(
    supabaseId: string,
    teamId: string,
    profileId: string
  ): Promise<RadarProfileTouchpoints> {
    const res = await fetch(`${this.baseUrl}/profiles/${profileId}/touchpoints`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarProfileTouchpoints>(res)
  }

  async getProfileContracts(
    supabaseId: string,
    teamId: string,
    profileId: string
  ): Promise<RadarProfileContracts> {
    const res = await fetch(`${this.baseUrl}/profiles/${profileId}/contracts`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<RadarProfileContracts>(res)
  }

  async materializeContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    name?: string
  ): Promise<{ listId: string; totalContacts: number }> {
    const res = await fetch(`${this.baseUrl}/segments/${encodeURIComponent(segmentSlug)}/materialize-list`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(name ? { name } : {}),
    })
    return parseOutput<{ listId: string; totalContacts: number }>(res)
  }

  async previewSegmentContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    variant: "system" | "custom"
  ): Promise<{ estimatedCount: number }> {
    const path =
      variant === "custom"
        ? `${this.baseUrl}/segments/custom/${segmentSlug}/materialize-contact-list`
        : `${this.baseUrl}/segments/${segmentSlug}/materialize-contact-list`
    const res = await fetch(path, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ estimatedCount: number }>(res)
  }

  async materializeSegmentToContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    variant: "system" | "custom"
  ): Promise<{ listId: string; contactCount: number }> {
    const path =
      variant === "custom"
        ? `${this.baseUrl}/segments/custom/${segmentSlug}/materialize-contact-list`
        : `${this.baseUrl}/segments/${segmentSlug}/materialize-contact-list`
    const res = await fetch(path, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return parseOutput<{ listId: string; contactCount: number }>(res)
  }
}

export const radarFrontendService = new RadarFrontendService()
