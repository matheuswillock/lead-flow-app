import type { DeliverabilityDashboard } from "../context/DeliverabilityTypes"

export type DeliverabilityFilters = {
  days: 7 | 30 | 90
  senderDomain?: string
  recipientProvider?: string
  campaignId?: string
}

export interface IDeliverabilityService {
  getDashboard(filters: DeliverabilityFilters): Promise<DeliverabilityDashboard>
}
