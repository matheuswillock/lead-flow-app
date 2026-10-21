import type { IBackofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/IBackofficeAdhesionPaymentRepository"
import type { IBillingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/IBillingGracePaymentRepository"
import type { BackofficeAdhesionProviderPaymentInput } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"

export type OwnerSettlementInput = {
  readonly ownerType: string
  readonly ownerId: string
  readonly externalId: string
  readonly paidAt: Date
}

export type OwnerSettlementResult = "settled" | "unsupported"

/** Aplica o efeito de domínio de um pagamento confirmado pelo provider. Idempotente. */
export interface PaymentOwnerSettlement {
  settleConfirmed(input: OwnerSettlementInput): Promise<OwnerSettlementResult>
}

export type PaymentOwnerSettlementDependencies = {
  readonly adhesionPayments: Pick<IBackofficeAdhesionPaymentRepository, "findById">
  readonly adhesions: {
    markPaidFromProvider(adhesionId: string, input: BackofficeAdhesionProviderPaymentInput): Promise<void>
  }
  readonly gracePayments: Pick<
    IBillingGracePaymentRepository,
    "findById" | "markConfirmed" | "completeAndRestoreAccess"
  >
}

export const SETTLED_OWNER_TYPES: ReadonlySet<string> = new Set([
  PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION,
  PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT,
])

export class PaymentOwnerSettlementService implements PaymentOwnerSettlement {
  constructor(private readonly dependencies: PaymentOwnerSettlementDependencies) {}

  async settleConfirmed(input: OwnerSettlementInput): Promise<OwnerSettlementResult> {
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION) {
      await this.settleAdhesion(input)
      return "settled"
    }
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT) {
      await this.settleGracePayment(input)
      return "settled"
    }
    return "unsupported"
  }

  private async settleAdhesion(input: OwnerSettlementInput): Promise<void> {
    const payment = await this.dependencies.adhesionPayments.findById(input.ownerId)
    if (!payment) throw new Error("Pagamento da adesão não encontrado")
    await this.dependencies.adhesions.markPaidFromProvider(payment.adhesionId, {
      paidAt: input.paidAt,
      providerPaymentId: input.externalId,
      adhesionPaymentId: payment.id,
    })
  }

  private async settleGracePayment(input: OwnerSettlementInput): Promise<void> {
    const { gracePayments } = this.dependencies
    const current = await gracePayments.findById(input.ownerId)
    if (current?.status === "completed") return
    const payment = await gracePayments.markConfirmed({
      id: input.ownerId,
      providerExternalId: input.externalId,
      confirmedAt: input.paidAt,
    })
    if (!payment) throw new Error("Regularização não encontrada ou já processada")
    await gracePayments.completeAndRestoreAccess(payment.id)
  }
}
