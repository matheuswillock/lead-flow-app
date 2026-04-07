import type { BackofficePayment } from "@prisma/client"

export interface CreateBackofficePaymentInput {
  id: string
  clientId: string
  billingType?: string
  amount: number
  dueDate?: Date
  description?: string
  asaasPaymentId?: string
  invoiceUrl?: string
  pixQrCode?: string
  pixPayload?: string
  createdByProfileId?: string
}

export interface UpdateBackofficePaymentExtra {
  invoiceUrl?: string
  pixQrCode?: string
  pixPayload?: string
}

export interface IBackofficePaymentRepository {
  create(data: CreateBackofficePaymentInput): Promise<BackofficePayment>
  findMany(params?: { clientId?: string; status?: string }): Promise<BackofficePayment[]>
  findById(id: string): Promise<BackofficePayment | null>
  findByAsaasPaymentId(asaasPaymentId: string): Promise<BackofficePayment | null>
  updateStatus(
    id: string,
    status: string,
    extra?: UpdateBackofficePaymentExtra
  ): Promise<BackofficePayment>
}
