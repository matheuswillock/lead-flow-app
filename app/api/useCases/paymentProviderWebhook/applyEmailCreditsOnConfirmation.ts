import { paymentProviderAlerter } from "@/app/api/services/paymentProviderAlert/paymentProviderAlerter"
import type { ApplyEmailCreditsPaidPurchaseResult } from "@/app/api/useCases/email/ApplyEmailCreditsPaidPurchaseUseCase"
import type { OperationalAlerter } from "@/lib/payment-provider/operational-alerts"

export type ApplyEmailCreditsOnConfirmationDependencies = {
  readonly purchases: {
    findById(id: string): Promise<{ id: string; purchaseType: string; productSlug: string } | null>
  }
  /** Mesmo aplicador do cron de manutenção; idempotente por `EmailCreditPaymentGrant.paymentId`. */
  readonly applyEmailCredits: (input: {
    paymentId: string
    checkoutId: string
    productSlug: string
  }) => Promise<ApplyEmailCreditsPaidPurchaseResult>
  readonly alerter?: Pick<OperationalAlerter, "alert">
}

/**
 * Libera os créditos de e-mail no próprio tratamento do evento confirmado. Falhas não derrubam o
 * webhook (a tentativa já está CONFIRMED e a reentrega não passaria mais por aqui): alertam, e o
 * cron de manutenção reaplica.
 */
export class ApplyEmailCreditsOnConfirmation {
  private readonly alerter: Pick<OperationalAlerter, "alert">

  constructor(private readonly dependencies: ApplyEmailCreditsOnConfirmationDependencies) {
    this.alerter = dependencies.alerter ?? paymentProviderAlerter
  }

  async apply(input: { purchaseId: string; externalId: string }): Promise<void> {
    try {
      const purchase = await this.dependencies.purchases.findById(input.purchaseId)
      if (!purchase || purchase.purchaseType !== "email_credits") return
      await this.dependencies.applyEmailCredits({
        paymentId: input.externalId,
        checkoutId: purchase.id,
        productSlug: purchase.productSlug,
      })
    } catch (error) {
      await this.alerter.alert({
        key: "email-credits-webhook-apply-failed",
        level: "error",
        message: `Créditos de e-mail não aplicados no webhook; o cron de manutenção reaplica: ${
          error instanceof Error ? error.message : "unknown"
        }`,
        context: { purchaseId: input.purchaseId, chargeId: input.externalId },
      })
    }
  }
}
