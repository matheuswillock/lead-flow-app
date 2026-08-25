export type MetricDeltaDirection = "up" | "down" | "neutral"

export type MetricDelta = {
  direction: MetricDeltaDirection
  absolute: number
  percent: number | null
}

export type AnalyticsRates = {
  deliverabilityRate: number
  openRate: number
  clickRate: number
  bounceRate: number
  complainRate: number
}

export type AnalyticsTotals = {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  failed: number
  deliveryDelayed: number
  unsubscribed: number
  suppressed: number
  formCompletions: number
  formViewed: number
  formStarted: number
}

export type AnalyticsData = {
  period: { from: string; to: string }
  totals: AnalyticsTotals
  rates: AnalyticsRates
  previous?: {
    period: { from: string; to: string }
    totals: AnalyticsTotals
    rates: AnalyticsRates
  }
  deltas?: {
    rates: Record<keyof AnalyticsRates, MetricDelta>
    totals: Record<keyof AnalyticsTotals, MetricDelta>
  }
  dispatches?: DispatchAnalyticsItem[]
  resendDomainTrackingCapable?: boolean
  /** Decidido no servidor pelo gate. `trackingWarnings` também existe sem bloqueio. */
  trackingDispatchBlocked?: boolean
  trackingWarnings?: string[]
}

export type DispatchAnalyticsStatus = "sending" | "completed" | "failed"

export type DispatchAnalyticsItem = {
  id: string
  dispatchNumber: number
  templateName: string
  templateVersionNumber: number
  templateSubject: string
  contactListName: string | null
  radarSegmentSlug: string | null
  dispatchedAt: string
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  status: DispatchAnalyticsStatus
  errorMessage?: string | null
  rates: AnalyticsRates
}

export type AnalyticsPeriod = "7d" | "30d" | "3m" | "6m"

export type DispatchPreviewData = {
  subject: string
  html: string
  templateVersionNumber: number
  templateName: string
}

export type RankedCampaignOverview = {
  campaignId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  rates: AnalyticsRates
  rank: number
}

export type OverviewData = AnalyticsData & {
  topCampaigns: RankedCampaignOverview[]
}

export type CompareCampaignItem = {
  campaignId: string
  name: string
  period: { from: string; to: string }
  totals: AnalyticsTotals
  rates: AnalyticsRates
  previous?: AnalyticsData["previous"]
  deltas?: AnalyticsData["deltas"]
}

export type CompareCampaignsData = {
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  resendDomainTrackingCapable?: boolean
  /** Decidido no servidor pelo gate. `trackingWarnings` também existe sem bloqueio. */
  trackingDispatchBlocked?: boolean
  trackingWarnings?: string[]
  campaigns: CompareCampaignItem[]
}
