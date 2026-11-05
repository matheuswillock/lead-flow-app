import * as Sentry from "@sentry/nextjs"

export type PaymentDisputedReport = {
  readonly eventId: string
  readonly externalPaymentId: string
  readonly attemptId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly tenantId: string
}

/**
 * Disputa (`transparent.disputed`) nunca reembolsa sozinha (decisão 17): a operação precisa
 * agir. Log estruturado + alerta no Sentry com o id da cobrança, sem payload nem segredo.
 */
export function reportPaymentDisputed(report: PaymentDisputedReport): void {
  console.error("[PaymentProviderWebhook][payment-disputed]", report)
  Sentry.captureMessage("Cobrança em disputa no provedor de pagamento", {
    level: "error",
    tags: { route: "PaymentProviderWebhook", phase: "payment-disputed", ownerType: report.ownerType },
    extra: report,
  })
}
