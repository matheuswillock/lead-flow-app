import type { ICdpService, ListProfilesParams } from "./ICdpService"
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

  async syncCrm(body?: { leadId?: string }): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/crm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncPortfolio(): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/portfolio`, { method: "POST" })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncEmail(): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/email`, { method: "POST" })
    return parseOutput<CdpSyncResult>(res)
  }

  async syncWhatsapp(): Promise<CdpSyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/whatsapp`, { method: "POST" })
    return parseOutput<CdpSyncResult>(res)
  }

  async listProfiles(params: ListProfilesParams) {
    if (params.segment) {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      })
      const res = await fetch(`${this.baseUrl}/segments/${params.segment}/profiles?${query}`)
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

    const res = await fetch(`${this.baseUrl}/profiles?${query}`)
    return parseOutput<{
      items: CdpProfileListItem[]
      total: number
      page: number
      pageSize: number
    }>(res)
  }

  async getProfile(id: string): Promise<CdpProfileDetail> {
    const res = await fetch(`${this.baseUrl}/profiles/${id}`)
    return parseOutput<CdpProfileDetail>(res)
  }

  async listSegments(): Promise<{ segments: CdpSegment[]; metrics: CdpMetrics }> {
    const res = await fetch(`${this.baseUrl}/segments`)
    return parseOutput<{ segments: CdpSegment[]; metrics: CdpMetrics }>(res)
  }

  async listSegmentProfiles(segment: string, page: number, pageSize: number) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${this.baseUrl}/segments/${segment}/profiles?${query}`)
    return parseOutput<{ items: CdpProfileDetail[]; total: number }>(res)
  }

  async listProfileEvents(profileId: string, page: number, pageSize: number) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${this.baseUrl}/profiles/${profileId}/events?${query}`)
    return parseOutput<{ items: CdpProfileDetail["events"]; total: number }>(res)
  }
}

export const cdpService = new CdpService()
