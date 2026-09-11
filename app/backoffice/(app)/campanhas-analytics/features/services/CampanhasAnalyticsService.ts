import { API_CLIENT_BASE } from "@/lib/route-map"
import type { CampaignAnalyticsQueryParams } from "../context/CampanhasAnalyticsTypes"
import type {
  CampaignAnalyticsDispatchesParams,
  CampaignAnalyticsExportParams,
  CampaignAnalyticsExportResult,
  ICampanhasAnalyticsService,
} from "./ICampanhasAnalyticsService"

const BASE_PATH = `${API_CLIENT_BASE}/backoffice/campanhas-analytics`

function buildRangeParams(params: CampaignAnalyticsQueryParams): URLSearchParams {
  const searchParams = new URLSearchParams({ from: params.from, to: params.to })
  if (params.teamIds.length > 0) searchParams.set("teamIds", params.teamIds.join(","))
  return searchParams
}

function parseCsvFilename(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition ? /filename="?([^";]+)"?/.exec(contentDisposition) : null
  return match?.[1] ?? fallback
}

export class CampanhasAnalyticsService implements ICampanhasAnalyticsService {
  async getSummary(params: CampaignAnalyticsQueryParams) {
    const searchParams = buildRangeParams(params)
    const response = await fetch(`${BASE_PATH}/summary?${searchParams}`, { cache: "no-store" })
    return response.json()
  }

  async getDispatches(params: CampaignAnalyticsDispatchesParams) {
    const searchParams = buildRangeParams(params)
    searchParams.set("page", String(params.page))
    searchParams.set("pageSize", String(params.pageSize))
    const response = await fetch(`${BASE_PATH}/dispatches?${searchParams}`, { cache: "no-store" })
    return response.json()
  }

  async getTeamsSeries(params: CampaignAnalyticsQueryParams) {
    const searchParams = buildRangeParams(params)
    const response = await fetch(`${BASE_PATH}/teams-series?${searchParams}`, { cache: "no-store" })
    return response.json()
  }

  async getTemplates(params: CampaignAnalyticsQueryParams) {
    const searchParams = buildRangeParams(params)
    const response = await fetch(`${BASE_PATH}/templates?${searchParams}`, { cache: "no-store" })
    return response.json()
  }

  async getFormsFunnel(params: CampaignAnalyticsQueryParams) {
    const searchParams = buildRangeParams(params)
    const response = await fetch(`${BASE_PATH}/forms-funnel?${searchParams}`, { cache: "no-store" })
    return response.json()
  }

  async exportCsv(params: CampaignAnalyticsExportParams): Promise<CampaignAnalyticsExportResult> {
    const searchParams = buildRangeParams(params)
    searchParams.set("dataset", params.dataset)
    const response = await fetch(`${BASE_PATH}/export.csv?${searchParams}`, { cache: "no-store" })

    const contentType = response.headers.get("content-type") ?? ""
    if (!response.ok || contentType.includes("application/json")) {
      const json = (await response.json().catch(() => null)) as { errorMessages?: string[] } | null
      throw new Error(json?.errorMessages?.[0] ?? `Erro ao exportar CSV (HTTP ${response.status})`)
    }

    const blob = await response.blob()
    const filename = parseCsvFilename(
      response.headers.get("content-disposition"),
      `campanhas_${params.dataset}_${params.from}_${params.to}.csv`
    )
    return { blob, filename }
  }
}
