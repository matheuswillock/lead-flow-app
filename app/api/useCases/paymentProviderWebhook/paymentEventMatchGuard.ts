import { paymentProviderAlerter } from "@/app/api/services/paymentProviderAlert/paymentProviderAlerter"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import type { OperationalAlerter } from "@/lib/payment-provider/operational-alerts"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { PaymentMethod, ProviderWebhookEvent } from "@/lib/payment-provider/types"

export class PaymentEventMismatchError extends PaymentProviderError {
  constructor(message: string) {
    super("VALIDATION_FAILED", message)
    this.name = "PaymentEventMismatchError"
  }
}

type ExpectedPayment = { readonly amountInCents: number; readonly method: PaymentMethod }

export type PaymentEventMatchGuardDependencies = {
  readonly purchases: {
    findById(id: string): Promise<{ amount: unknown; billingType?: string | null } | null>
  }
  readonly adhesionPayments: { findById(id: string): Promise<{ amountCents: number } | null> }
  readonly gracePayments: { findById(id: string): Promise<{ amountCents: number } | null> }
  readonly alerter?: Pick<OperationalAlerter, "alert">
}

type GuardedAttempt = { readonly id: string; readonly ownerType: string; readonly ownerId: string }

/**
 * Confere valor (centavos) e método do evento confirmado contra o que o dono da tentativa espera,
 * antes de qualquer efeito de domínio. Divergência lança e a inbox registra a falha (auditoria).
 */
export class PaymentEventMatchGuard {
  private readonly alerter: Pick<OperationalAlerter, "alert">

  constructor(private readonly dependencies: PaymentEventMatchGuardDependencies) {
    this.alerter = dependencies.alerter ?? paymentProviderAlerter
  }

  async assertMatches(attempt: GuardedAttempt, event: ProviderWebhookEvent): Promise<void> {
    // Só a confirmação libera efeito de domínio; reembolso e disputa só movem a tentativa.
    if (event.event !== "PAYMENT_CONFIRMED") return
    if (!isKnownOwner(attempt.ownerType)) return

    const expected = await this.resolveExpected(attempt)
    const divergence = expected ? describeDivergence(expected, event) : "dono do pagamento não encontrado"
    if (divergence === null) return

    await this.alerter.alert({
      key: "payment-event-mismatch",
      level: "error",
      slack: true,
      message: `Evento de pagamento rejeitado: ${divergence}`,
      context: {
        attemptId: attempt.id,
        ownerType: attempt.ownerType,
        eventId: event.eventId,
        chargeId: event.externalPaymentId,
      },
    })
    throw new PaymentEventMismatchError(`Evento rejeitado: ${divergence}`)
  }

  private async resolveExpected(attempt: GuardedAttempt): Promise<ExpectedPayment | null> {
    const { purchases, adhesionPayments, gracePayments } = this.dependencies
    switch (attempt.ownerType) {
      case PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE: {
        const purchase = await purchases.findById(attempt.ownerId)
        return purchase
          ? { amountInCents: toCents(purchase.amount), method: methodOfBillingType(purchase.billingType) }
          : null
      }
      case PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION: {
        const payment = await adhesionPayments.findById(attempt.ownerId)
        return payment ? { amountInCents: payment.amountCents, method: "PIX" } : null
      }
      default: {
        const payment = await gracePayments.findById(attempt.ownerId)
        return payment ? { amountInCents: payment.amountCents, method: "PIX" } : null
      }
    }
  }
}

function isKnownOwner(ownerType: string): boolean {
  return (
    ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE ||
    ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION ||
    ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT
  )
}

function describeDivergence(expected: ExpectedPayment, event: ProviderWebhookEvent): string | null {
  if (event.amountInCents === null) return "valor do evento ausente"
  if (event.amountInCents !== expected.amountInCents) {
    return `valor divergente (evento ${event.amountInCents}, esperado ${expected.amountInCents} centavos)`
  }
  if (event.method !== expected.method) {
    return `método divergente (evento ${event.method ?? "ausente"}, esperado ${expected.method})`
  }
  return null
}

function methodOfBillingType(billingType: string | null | undefined): PaymentMethod {
  return billingType === "CREDIT_CARD" ? "CARD" : "PIX"
}

function toCents(amount: unknown): number {
  return Math.round(Number(String(amount)) * 100)
}
