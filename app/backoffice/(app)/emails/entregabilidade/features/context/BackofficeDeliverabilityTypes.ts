export type BackofficeDeliverabilityTeam = {
  teamId: string
  teamName: string
  sent: number
  delivered: number
  bounced: number
  complained: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
}
