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
  campaigns: Array<{
    id: string
    name: string
    sentAt: string | null
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    totalBounced: number
    totalComplained: number
  }>
}

export type AnalyticsPeriod = '7d' | '30d' | '3m' | '6m'

export type AnalyticsState = {
  data: AnalyticsData | null
  loading: boolean
  period: AnalyticsPeriod
  campaignId: string
  campaigns: Array<{ id: string; name: string }>
}
