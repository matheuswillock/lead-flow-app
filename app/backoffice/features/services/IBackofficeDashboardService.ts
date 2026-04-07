export interface BackofficeClientSummary {
  id: string
  fullName: string
  isActive: boolean
}

export interface BackofficePaymentSummary {
  id: string
  status: string
  amount: number | string
}

export interface IBackofficeDashboardService {
  fetchClients(): Promise<BackofficeClientSummary[]>
  fetchPayments(): Promise<BackofficePaymentSummary[]>
}
