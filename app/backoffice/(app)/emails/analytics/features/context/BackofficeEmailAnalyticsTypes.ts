export type AnalyticsData = {
  period: { from: string; to: string }
  totals: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }
  rates: {
    deliverabilityRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    complainRate: number
  }
  dispatches?: DispatchAnalyticsItem[]
}

export type DispatchAnalyticsStatus = "sending" | "completed" | "failed"

export type DispatchAnalyticsItem = {
  id: string
  dispatchNumber: number
  templateSubjectSnapshot: string
  createdAt: string
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  status: DispatchAnalyticsStatus
  rates: AnalyticsData["rates"]
}

export type AnalyticsPeriod = "7d" | "30d" | "3m" | "6m"

export interface BackofficeCampaignOption {
  id: string
  name: string
}
