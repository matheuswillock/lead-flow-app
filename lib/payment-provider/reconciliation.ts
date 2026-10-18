import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

type ReconciliationBase = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly paymentAttemptId: string
  readonly externalReference: string
  readonly reason: "REMOTE_TIMEOUT" | "REMOTE_ERROR"
  readonly createdAt: string
}

export type PendingReconciliation = ReconciliationBase & {
  readonly status: "PENDING"
}

export type ResolvedReconciliation = ReconciliationBase & {
  readonly status: "RESOLVED"
  readonly resolution: "CONFIRMED_ABSENT" | "CONFIRMED_REMOTE" | "CANCELED"
  readonly actorId: string
  readonly auditReference: string
  readonly resolvedAt: string
}

export type PaymentReconciliation = PendingReconciliation | ResolvedReconciliation

export function createPendingReconciliation(input: Omit<PendingReconciliation, "status" | "createdAt">): PendingReconciliation {
  return Object.freeze({ ...input, status: "PENDING", createdAt: new Date().toISOString() })
}

export function resolveReconciliation(
  pending: PendingReconciliation,
  input: ResolvedReconciliationInput,
): ResolvedReconciliation {
  if (!input.actorId.trim() || !input.auditReference.trim()) {
    throw new Error("Resolução de reconciliação exige ator e referência de auditoria")
  }
  return Object.freeze({
    ...pending,
    status: "RESOLVED",
    resolution: input.resolution,
    actorId: input.actorId,
    auditReference: input.auditReference,
    resolvedAt: new Date().toISOString(),
  })
}

export function assertPaymentCanBeChargedAgain(reconciliation: PaymentReconciliation): void {
  if (reconciliation.status === "PENDING") {
    throw new Error("Cobrança bloqueada até a reconciliação auditada")
  }
  if (reconciliation.resolution !== "CONFIRMED_ABSENT") {
    throw new Error("Cobrança bloqueada: a reconciliação confirmou uma cobrança remota")
  }
}

type ResolvedReconciliationInput = {
  readonly resolution: ResolvedReconciliation["resolution"]
  readonly actorId: string
  readonly auditReference: string
}
