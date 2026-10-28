import * as Sentry from "@sentry/nextjs"

export type RejectedConfirmationReason = "STATUS_NOT_PAID" | "AMOUNT_MISMATCH"

export type RejectedConfirmationReport = {
  readonly eventId: string
  readonly externalPaymentId: string
  readonly attemptId: string
  readonly ownerType: string
  readonly queriedStatus: string
  readonly queriedAmountInCents: number | null
  readonly eventAmountInCents: number | null
  readonly reason: RejectedConfirmationReason
}

/**
 * Evento de confirmação que a reconsulta no provedor contradisse (possível evento forjado ou
 * divergência de valor). Nenhum efeito de domínio foi aplicado. Só ids, status e valores.
 */
export function reportRejectedConfirmation(report: RejectedConfirmationReport): void {
  console.error("[PaymentProviderWebhook][confirmation-rejected]", report)
  Sentry.captureMessage("Confirmação de pagamento rejeitada pela reconsulta no provedor", {
    level: "error",
    tags: { route: "PaymentProviderWebhook", phase: "confirmation-rejected", reason: report.reason },
    extra: report,
  })
}
