export type AnalyticsData = {
  period: { from: string; to: string }
  totals: {
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
  templateName: string
  templateVersionNumber: number
  templateSubject: string
  contactListName: string | null
  cdpSegmentSlug: string | null
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
  rates: AnalyticsData["rates"]
}

export type AnalyticsPeriod = "7d" | "30d" | "3m" | "6m"

export type DispatchPreviewData = {
  subject: string
  html: string
  templateVersionNumber: number
  templateName: string
}
