import type { PaymentCharge, PaymentChargeEvent, Prisma } from "@prisma/client"
import type { ChargeStatus } from "@/lib/payments/charge-status"
import type { ChargePurpose, ChargeSource } from "@/lib/payments/types"

export type CreatePaymentChargeInput = {
  readonly profileId: string
  readonly subscriptionId?: string | null
  readonly purpose: ChargePurpose
  readonly purposeRefId?: string | null
  readonly status: ChargeStatus
  readonly rawStatus?: string | null
  readonly amountCents: number
  readonly currency?: string
  readonly method?: string | null
  readonly cycleKey?: string | null
  readonly dueDate?: Date | null
  readonly paidAt?: Date | null
  readonly provider: string
  readonly providerEnvironment: string
  readonly providerContext: string
  readonly providerSessionId?: string | null
  readonly providerAttemptId?: string | null
  readonly providerExternalId?: string | null
  readonly paymentInstructions?: Prisma.InputJsonValue
  readonly idempotencyKey: string
  readonly source: ChargeSource
  /** Quem originou a linha; vai para o evento de criação. */
  readonly actor: string
}

export type ChargeExternalIdentity = {
  readonly provider: string
  readonly providerEnvironment: string
  readonly providerContext: string
  readonly providerExternalId: string
}

export type TransitionPaymentChargeInput = {
  readonly id: string
  readonly expectedStatus: ChargeStatus
  readonly toStatus: ChargeStatus
  readonly rawStatus?: string | null
  readonly paidAt?: Date | null
  readonly actor: string
}

/** Campos que podem ser completados sem mudar o status (nunca sobrescrevem valor já gravado). */
export type PaymentChargeBackfill = {
  readonly providerSessionId?: string | null
  readonly providerAttemptId?: string | null
  readonly providerExternalId?: string | null
  readonly paymentInstructions?: Prisma.InputJsonValue
  readonly paidAt?: Date | null
  readonly rawStatus?: string | null
}

export type ListMirrorChargesInput = {
  readonly sources: readonly ChargeSource[]
  readonly createdAfter: Date
  readonly limit: number
  readonly afterId?: string
}

export interface IPaymentChargeRepository {
  /** Cria a linha e o evento inicial na mesma transação. Lança em violação de unicidade. */
  create(input: CreatePaymentChargeInput): Promise<PaymentCharge>
  findById(id: string): Promise<PaymentCharge | null>
  findByIdempotencyKey(input: {
    profileId: string
    idempotencyKey: string
  }): Promise<PaymentCharge | null>
  findByExternalIdentity(input: ChargeExternalIdentity): Promise<PaymentCharge | null>
  findByPurposeRef(input: {
    purpose: ChargePurpose
    purposeRefId: string
  }): Promise<PaymentCharge | null>
  /**
   * Compare-and-set: só transiciona se o status ainda for o esperado, e grava o evento na mesma
   * transação. Devolve null quando outro processo venceu a corrida.
   */
  transition(input: TransitionPaymentChargeInput): Promise<PaymentCharge | null>
  backfill(id: string, fields: PaymentChargeBackfill): Promise<PaymentCharge | null>
  listEvents(chargeId: string): Promise<readonly PaymentChargeEvent[]>
  listForDivergence(input: ListMirrorChargesInput): Promise<readonly PaymentCharge[]>
}
