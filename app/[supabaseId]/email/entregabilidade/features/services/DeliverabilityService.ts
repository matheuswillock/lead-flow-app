import { API_CLIENT_BASE } from "@/lib/route-map"
import type { DeliverabilityDashboard } from "../context/DeliverabilityTypes"
import type { DeliverabilityFilters, IDeliverabilityService } from "./IDeliverabilityService"

export class DeliverabilityService implements IDeliverabilityService {
  async getDashboard(filters: DeliverabilityFilters): Promise<DeliverabilityDashboard> {
    const params = new URLSearchParams({ days: String(filters.days) })
    if (filters.senderDomain) params.set("domain", filters.senderDomain)
    if (filters.recipientProvider) params.set("provider", filters.recipientProvider)
    if (filters.campaignId) params.set("campaignId", filters.campaignId)
    const response = await fetch(`${API_CLIENT_BASE}/email/analytics/deliverability?${params}`)
    const output = await response.json().catch(() => null)
    if (!response.ok || !output?.isValid) {
      throw new Error(output?.errorMessages?.join(", ") ?? "Não foi possível carregar a entrega")
    }
    return output.result as DeliverabilityDashboard
  }
}
