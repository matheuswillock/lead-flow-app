import * as Sentry from "@sentry/nextjs"

export type UnknownOwnerAttempt = {
  readonly id: string
  readonly ownerType: string
  readonly ownerId: string
  readonly tenantId: string
}

/**
 * Pagamento confirmado cujo owner não tem efeito de domínio mapeado: o dinheiro entrou e nada
 * foi liberado. Log estruturado + alerta no Sentry para a operação agir.
 */
export function reportUnknownOwnerType(attempt: UnknownOwnerAttempt): void {
  const context = {
    attemptId: attempt.id,
    ownerType: attempt.ownerType,
    ownerId: attempt.ownerId,
    tenantId: attempt.tenantId,
  }
  console.error("[PaymentProviderWebhook][unknown-owner-type]", context)
  Sentry.captureMessage("Pagamento confirmado com ownerType sem efeito de domínio", {
    level: "error",
    tags: { route: "PaymentProviderWebhook", phase: "unknown-owner-type", ownerType: attempt.ownerType },
    extra: context,
  })
}
