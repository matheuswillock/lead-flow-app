import { API_CLIENT_BASE } from "@/lib/route-map"
import type { IBackofficeDeliverabilityService } from "./IBackofficeDeliverabilityService"
import type { BackofficeDeliverabilityTeam } from "../context/BackofficeDeliverabilityTypes"

export class BackofficeDeliverabilityService implements IBackofficeDeliverabilityService {
  async list(filters: { days: 7 | 30 | 90; teamId?: string; domain?: string; provider?: string }): Promise<BackofficeDeliverabilityTeam[]> {
    const params = new URLSearchParams({ days: String(filters.days) })
    if (filters.teamId) params.set("teamId", filters.teamId)
    if (filters.domain) params.set("domain", filters.domain)
    if (filters.provider) params.set("provider", filters.provider)
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/email-deliverability?${params}`, { cache: "no-store" })
    const output = await response.json().catch(() => null)
    if (!response.ok || !output?.isValid) throw new Error(output?.errorMessages?.[0] ?? "Falha ao carregar reputação")
    return output.result.teams as BackofficeDeliverabilityTeam[]
  }
}
