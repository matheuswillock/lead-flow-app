import { paymentProviderAlerter } from "@/app/api/services/paymentProviderAlert/paymentProviderAlerter"
import type { OperationalAlerter } from "@/lib/payment-provider/operational-alerts"

export type DisputedPayment = {
  readonly attemptId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly chargeId: string
  readonly eventId: string
}

/** Disputa é decisão humana: só alerta (Sentry + Slack) com o id da cobrança; nunca reembolsa. */
export async function reportPaymentDisputed(
  payment: DisputedPayment,
  alerter: Pick<OperationalAlerter, "alert"> = paymentProviderAlerter,
): Promise<void> {
  await alerter.alert({
    key: "payment-disputed",
    level: "error",
    slack: true,
    message: `Cobrança ${payment.chargeId} em disputa: tratar manualmente no Abacate Pay (sem reembolso automático)`,
    context: { ...payment },
  })
}
