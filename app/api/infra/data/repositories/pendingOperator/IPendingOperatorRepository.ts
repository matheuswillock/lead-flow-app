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
  deleteById(id: string): Promise<void>
}
