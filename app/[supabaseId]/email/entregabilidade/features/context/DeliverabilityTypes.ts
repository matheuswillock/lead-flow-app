export type DeliverabilityTotals = {
  sent: number
  delivered: number
  hardBounced: number
  softBounced: number
  complained: number
  humanOpened: number
  clicked: number
  suppressed: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
  humanOpenRate: number
  clickRate: number
}

export type DeliverabilityDashboard = {
  summary: DeliverabilityTotals
  series: Array<DeliverabilityTotals & { date: string }>
  domains: Array<DeliverabilityTotals & { senderDomain: string }>
  providers: Array<DeliverabilityTotals & { recipientProvider: string }>
}
