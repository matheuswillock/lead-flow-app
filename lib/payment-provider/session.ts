import { randomUUID } from "node:crypto"
import type { PaymentAttemptStatus } from "./types"

export type ProviderLeaseState = {
  readonly leaseToken: string | null
  readonly leaseUntil: Date | null
  readonly fenceVersion: number
}

export type AcquireProviderLeaseInput = {
  readonly current: ProviderLeaseState
  readonly now: Date
  readonly ttlMs: number
  readonly requestedBy: string
}

export type AssertProviderLeaseInput = {
  readonly expected: ProviderLeaseState
  readonly presented: ProviderLeaseState
  readonly now: Date
}

export type ProviderLeaseErrorCode = "LEASE_HELD" | "STALE_FENCE" | "STALE_TOKEN" | "LEASE_EXPIRED"

export class PaymentProviderLeaseError extends Error {
  constructor(
    readonly code: ProviderLeaseErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "PaymentProviderLeaseError"
  }
}

export function acquireProviderLease(input: AcquireProviderLeaseInput): ProviderLeaseState {
  if (!input.requestedBy.trim()) throw new Error("Worker da lease é obrigatório")
  if (!Number.isInteger(input.ttlMs) || input.ttlMs <= 0) {
    throw new Error("TTL da lease inválido")
  }
  if (isLeaseLive(input.current, input.now)) {
    throw new PaymentProviderLeaseError("LEASE_HELD", "A lease ativa pertence a outro worker")
  }
  return Object.freeze({
    leaseToken: randomUUID(),
    leaseUntil: new Date(input.now.getTime() + input.ttlMs),
    fenceVersion: input.current.fenceVersion + 1,
  })
}

export function assertProviderLease(input: AssertProviderLeaseInput): void {
  if (input.presented.fenceVersion !== input.expected.fenceVersion) {
    throw new PaymentProviderLeaseError("STALE_FENCE", "A versão de fence da lease está obsoleta")
  }
  if (input.presented.leaseToken !== input.expected.leaseToken) {
    throw new PaymentProviderLeaseError("STALE_TOKEN", "O token da lease está obsoleto")
  }
  if (!input.expected.leaseUntil || input.expected.leaseUntil.getTime() <= input.now.getTime()) {
    throw new PaymentProviderLeaseError("LEASE_EXPIRED", "A lease está expirada")
  }
}

export function assertAttemptStatusTransition(
  current: PaymentAttemptStatus,
  next: PaymentAttemptStatus,
): void {
  const allowed: Readonly<Record<PaymentAttemptStatus, readonly PaymentAttemptStatus[]>> = {
    CREATED: [
      "PENDING",
      "CONFIRMED",
      "DISPUTED",
      "REFUNDED",
      "FAILED",
      "CANCELED",
      "UNKNOWN",
    ],
    PENDING: ["CONFIRMED", "FAILED", "DISPUTED", "EXPIRED", "CANCELED", "UNKNOWN"],
    CONFIRMED: ["REFUNDED", "DISPUTED"],
    FAILED: [],
    REFUNDED: [],
    DISPUTED: ["REFUNDED"],
    EXPIRED: [],
    CANCELED: [],
    UNKNOWN: ["PENDING", "CONFIRMED", "FAILED", "REFUNDED", "DISPUTED", "EXPIRED", "CANCELED"],
  }
  if (current === next || !allowed[current].includes(next)) {
    throw new PaymentProviderLeaseError(
      "STALE_FENCE",
      `Transição de tentativa inválida: ${current} -> ${next}`,
    )
  }
}

function isLeaseLive(state: ProviderLeaseState, now: Date): boolean {
  return state.leaseUntil !== null && state.leaseUntil.getTime() > now.getTime()
}
