import type { PendingOperator, Profile, UserFunction } from "@prisma/client"

export type PendingOperatorWithManager = PendingOperator & {
  manager: Pick<
    Profile,
    | "id"
    | "email"
    | "fullName"
    | "supabaseId"
    | "asaasSubscriptionId"
    | "asaasSubscriptionAccount"
    | "asaasCustomerId"
    | "asaasCustomerAccount"
    | "timezone"
  >
}

export interface CreatePendingOperatorInput {
  managerId: string
  teamId?: string | null
  name: string
  email: string
  role: string
  functions: UserFunction[]
  paymentId: string
  subscriptionId?: string | null
  paymentStatus: string
  paymentMethod: string
}

export interface IPendingOperatorRepository {
  create(data: CreatePendingOperatorInput): Promise<PendingOperator>
  findByPaymentIdWithManager(paymentId: string): Promise<PendingOperatorWithManager | null>
  updatePaymentId(id: string, paymentId: string): Promise<void>
  // Marca que o incremento de +R$19,90 na assinatura antiga do manager já
  // foi aplicado (achado Codex no PR #1137, P1) — processOperatorCheckoutPaid
  // consulta este marcador antes de reaplicar o incremento numa retentativa
  // do webhook, evitando cobrar o mesmo operador duas vezes.
  markSubscriptionUpdated(id: string): Promise<void>
  deleteById(id: string): Promise<void>
}
