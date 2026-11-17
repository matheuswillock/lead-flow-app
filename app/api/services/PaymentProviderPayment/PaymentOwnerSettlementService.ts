import type { IBackofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/IBackofficeAdhesionPaymentRepository"
import type { IBillingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/IBillingGracePaymentRepository"
import type { BackofficeAdhesionProviderPaymentInput } from "../backofficeAdhesion/IBackofficeAdhesionService"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { Output } from "@/lib/output"

export type OwnerSettlementInput = {
  readonly ownerType: string
  readonly ownerId: string
  readonly externalId: string
  /** Valor confirmado pelo provider (webhook/consulta), em centavos; null = não informado. */
  readonly amountInCents: number | null
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
  readonly pendingActions: {
    /** Valor em centavos cobrado para a ação; null quando a ação não existe. */
    expectedAmountInCents(pendingActionId: string): Promise<number | null>
    applyById(pendingActionId: string): Promise<Output>
  }
}

export const SETTLED_OWNER_TYPES: ReadonlySet<string> = new Set([
  PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION,
  PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT,
  PAYMENT_PROVIDER_OWNER_TYPES.PENDING_ACTION_ADDON,
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
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PENDING_ACTION_ADDON) {
      await this.settleAddOn(input)
      return "settled"
    }
    return "unsupported"
  }

  private async settleAddOn(input: OwnerSettlementInput): Promise<void> {
    const { pendingActions } = this.dependencies
    if (input.amountInCents === null) {
      throw new Error("Pagamento de add-on sem valor informado pelo provider")
    }
    const expected = await pendingActions.expectedAmountInCents(input.ownerId)
    if (expected === null) throw new Error("Ação pendente não encontrada")
    if (expected !== input.amountInCents) {
      throw new Error("Valor pago não confere com a cobrança do add-on")
    }
    const applied = await pendingActions.applyById(input.ownerId)
    if (!applied.isValid) {
      throw new Error(applied.errorMessages.join("; ") || "Ação pendente não aplicada")
    }
  }

  private async settleAdhesion(input: OwnerSettlementInput): Promise<void> {
    const payment = await this.dependencies.adhesionPayments.findById(input.ownerId)
    if (!payment) throw new Error("Pagamento da adesão não encontrado")
    await this.dependencies.adhesions.markPaidFromProvider(payment.adhesionId, {
      paidAt: input.paidAt,
      providerPaymentId: input.externalId,
      adhesionPaymentId: payment.id,
      amountInCents: input.amountInCents,
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
