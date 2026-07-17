export type BackofficeEmailAnalyticsLogWhere = {
  from: Date
  to: Date
  campaignId?: string
}

export type BackofficeEmailAnalyticsDispatchRecord = {
  id: string
  dispatchNumber: number
  templateSubjectSnapshot: string
  createdAt: Date
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  status: string
}

export interface IBackofficeEmailAnalyticsRepository {
  countLogs(
    where: BackofficeEmailAnalyticsLogWhere,
    filter?: "delivered" | "opened" | "clicked" | "bounced" | "complained"
  ): Promise<number>
  listDispatches(options: {
    campaignId: string
    from: Date
    to: Date
  }): Promise<BackofficeEmailAnalyticsDispatchRecord[]>
}
