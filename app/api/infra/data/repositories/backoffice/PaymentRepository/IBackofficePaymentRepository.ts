import type { BackofficePayment } from "@prisma/client"
import type { AsaasAccountId } from "@/lib/asaas"

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
  /**
   * Filtra por conta (E4 de [[10 — Fundações Multi-conta — Backend]], C33):
   * o mesmo `asaasPaymentId` pode existir nas duas contas durante a janela
   * dual — sem o filtro, um evento da conta errada atualiza o pagamento da
   * outra.
   */
  findByAsaasPaymentId(
    asaasPaymentId: string,
    account: AsaasAccountId
  ): Promise<BackofficePayment | null>
  updateStatus(
    id: string,
    status: string,
    extra?: UpdateBackofficePaymentExtra
  ): Promise<BackofficePayment>
}
