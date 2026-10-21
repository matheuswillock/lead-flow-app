import type { IBackofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/IBackofficeAdhesionPaymentRepository"
import type { IBillingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/IBillingGracePaymentRepository"
import type { BackofficeAdhesionProviderPaymentInput } from "../backofficeAdhesion/IBackofficeAdhesionService"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { OwnerChargeMirror } from "../paymentCharge/OwnerChargeMirror"

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
  /** Liquidação por finalidade das cobranças do ledger (ownerType PAYMENT_CHARGE). */
  readonly paymentCharges: PaymentOwnerSettlement
  /** Espelho no ledger dos donos já neutros; nunca lança nem altera o efeito. */
  readonly ledgerMirror: Pick<OwnerChargeMirror, "mirrorSettled">
}

export const SETTLED_OWNER_TYPES: ReadonlySet<string> = new Set([
  PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION,
  PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT,
  PAYMENT_PROVIDER_OWNER_TYPES.PAYMENT_CHARGE,
])

export class PaymentOwnerSettlementService implements PaymentOwnerSettlement {
  constructor(private readonly dependencies: PaymentOwnerSettlementDependencies) {}

  async settleConfirmed(input: OwnerSettlementInput): Promise<OwnerSettlementResult> {
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION) {
      await this.settleAdhesion(input)
      await this.mirrorToLedger(input)
      return "settled"
    }
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT) {
      await this.settleGracePayment(input)
      await this.mirrorToLedger(input)
      return "settled"
    }
    if (input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PAYMENT_CHARGE) {
      return this.dependencies.paymentCharges.settleConfirmed(input)
    }
    return "unsupported"
  }

  // Cinto e suspensório: o espelho já não lança, mas o efeito de domínio nunca depende dele.
  private async mirrorToLedger(input: OwnerSettlementInput): Promise<void> {
    try {
      await this.dependencies.ledgerMirror.mirrorSettled(input)
    } catch (error) {
      console.error("[PaymentOwnerSettlementService][ledger-mirror] Error", {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        message: error instanceof Error ? error.message : "unknown",
      })
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
