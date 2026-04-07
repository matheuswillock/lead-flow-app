export interface BackofficeClientItem {
  id: string
  fullName: string
  email: string | null
  asaasCustomerId: string | null
}

export interface BackofficePaymentItem {
  id: string
  clientId: string
  billingType: string
  status: string
  amount: string | number
  dueDate: string | null
  description: string | null
  invoiceUrl: string | null
  pixQrCode: string | null
  pixPayload: string | null
  asaasPaymentId: string | null
  createdAt: string
}

export interface CreatePaymentFormData {
  clientId: string
  billingType?: string
  amount: number
  dueDate?: string
  description?: string
}

export interface IBackofficePaymentsService {
  list(clientId?: string): Promise<BackofficePaymentItem[]>
  create(data: CreatePaymentFormData): Promise<{ isValid: boolean; errorMessages: string[]; result?: BackofficePaymentItem }>
  listClients(): Promise<BackofficeClientItem[]>
}
