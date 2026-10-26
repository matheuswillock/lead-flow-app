import { PaymentProviderError } from "./errors"

export type PaymentProviderKey = "ASAAS" | "ABACATE_PAY"
export type PaymentProviderEnvironment = "DEV" | "PRODUCTION"
export type PaymentMethod = "PIX" | "CARD"
export type PaymentCapability =
  | "CUSTOMER"
  | "CATALOG"
  | "ONE_TIME_PAYMENT"
  | "PIX"
  | "CARD"
  | "STATUS_QUERY"
  | "FULL_REFUND"
  | "WEBHOOK"

export type PaymentAttemptStatus =
  | "CREATED"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED"
  | "EXPIRED"
  | "CANCELED"
  | "UNKNOWN"

export const PAYMENT_PROVIDER_KEYS = Object.freeze({
  ASAAS: "ASAAS",
  ABACATE_PAY: "ABACATE_PAY",
} as const satisfies Record<PaymentProviderKey, PaymentProviderKey>)

export const PAYMENT_METHODS = Object.freeze({
  PIX: "PIX",
  CARD: "CARD",
} as const satisfies Record<PaymentMethod, PaymentMethod>)

export const PAYMENT_CAPABILITIES = Object.freeze({
  CUSTOMER: "CUSTOMER",
  CATALOG: "CATALOG",
  ONE_TIME_PAYMENT: "ONE_TIME_PAYMENT",
  PIX: "PIX",
  CARD: "CARD",
  STATUS_QUERY: "STATUS_QUERY",
  FULL_REFUND: "FULL_REFUND",
  WEBHOOK: "WEBHOOK",
} as const satisfies Record<PaymentCapability, PaymentCapability>)

export const PAYMENT_ATTEMPT_STATUSES = Object.freeze({
  CREATED: "CREATED",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  DISPUTED: "DISPUTED",
  EXPIRED: "EXPIRED",
  CANCELED: "CANCELED",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<PaymentAttemptStatus, PaymentAttemptStatus>)

export class PaymentAmount {
  readonly currency = "BRL" as const

  private constructor(readonly cents: number) {
    Object.freeze(this)
  }

  static fromCents(cents: number): PaymentAmount {
    if (!Number.isInteger(cents)) {
      throw new Error("O valor deve ser um número inteiro de centavos")
    }
    if (!Number.isSafeInteger(cents)) {
      throw new Error("O valor deve ser um número inteiro seguro de centavos")
    }
    if (cents < 100) {
      throw new Error("O valor deve ter no mínimo 100 centavos")
    }
    return new PaymentAmount(cents)
  }
}

export type IndeterminatePaymentResult = {
  readonly status: "UNKNOWN"
  readonly externalId: string | null
  readonly reconciliationReference?: string
  readonly reason: "REMOTE_TIMEOUT" | "REMOTE_ERROR" | "MISSING_EXTERNAL_ID"
  readonly requiresReconciliation: true
}

export type KnownPaymentAttemptStatus = Exclude<PaymentAttemptStatus, "UNKNOWN">

type ProviderPaymentResultBase = {
  readonly externalId: string
  readonly status: KnownPaymentAttemptStatus
  readonly amountInCents: number
  readonly currency: "BRL"
}

export type ProviderPixInstructions = {
  readonly brCode: string
  readonly brCodeBase64: string
  readonly expiresAt: string
}

export type ProviderPixPaymentResult = ProviderPaymentResultBase & {
  readonly method: "PIX"
  readonly pix: ProviderPixInstructions
}

export type ProviderCardPaymentResult = ProviderPaymentResultBase & {
  readonly method: "CARD"
  readonly pix?: never
}

export type ProviderPaymentOutcome =
  | ProviderPixPaymentResult
  | ProviderCardPaymentResult
  | IndeterminatePaymentResult

export function createIndeterminatePaymentResult(input: {
  readonly reason: IndeterminatePaymentResult["reason"]
  readonly externalId?: string | null
  readonly reconciliationReference?: string
}): IndeterminatePaymentResult {
  return freezePaymentValue({
    status: "UNKNOWN",
    externalId: input.externalId?.trim() || null,
    ...(input.reconciliationReference?.trim()
      ? { reconciliationReference: input.reconciliationReference.trim() }
      : {}),
    reason: input.reason,
    requiresReconciliation: true,
  })
}

export function freezePaymentValue<const T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value
  for (const nestedValue of Object.values(value)) freezePaymentValue(nestedValue)
  return Object.freeze(value)
}

export type ProviderPaymentResult = ProviderPixPaymentResult | ProviderCardPaymentResult

type ProviderStatusResultBase = {
  readonly externalId: string
  readonly method: PaymentMethod
  readonly amountInCents: number | null
  readonly currency: "BRL"
}

export type ProviderStatusResult =
  | (ProviderStatusResultBase & { readonly status: KnownPaymentAttemptStatus })
  | (ProviderStatusResultBase & {
      readonly status: "UNKNOWN"
      readonly reason: IndeterminatePaymentResult["reason"]
      readonly requiresReconciliation: true
    })

type ProviderWebhookEventBase = {
  readonly eventId: string
  readonly event: "PAYMENT_CONFIRMED" | "PAYMENT_REFUNDED" | "PAYMENT_DISPUTED"
  readonly environment: PaymentProviderEnvironment
  readonly method: PaymentMethod | null
  readonly amountInCents: number | null
  readonly occurredAt: string | null
  readonly disputeEpoch: number | null
  /**
   * The attempt id extracted from the provider webhook payload (e.g.
   * AbacatePay's metadata.attemptId). When present it provides an
   * attempt-unique correlation for events whose attempt never received
   * the provider charge id (indeterminate initiations).
   */
  readonly attemptId?: string
}

export type ProviderWebhookEvent =
  | (ProviderWebhookEventBase & {
      readonly externalPaymentId: string
      readonly status: KnownPaymentAttemptStatus
    })
  | (ProviderWebhookEventBase & {
      readonly externalPaymentId: string | null
      readonly status: "UNKNOWN"
      readonly reason: IndeterminatePaymentResult["reason"]
      readonly requiresReconciliation: true
    })

export function assertPositiveCents(amountInCents: number): void {
  try {
    PaymentAmount.fromCents(amountInCents)
  } catch (error) {
    throw new PaymentProviderError(
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "Valor em centavos inválido",
    )
  }
}

export function mapProviderStatus(status: unknown): PaymentAttemptStatus {
  switch (status) {
    case "APPROVED":
    case "PAID":
    case "COMPLETED":
      return "CONFIRMED"
    case "PENDING":
    case "WAITING_PAYMENT":
      return "PENDING"
    case "REFUNDED":
      return "REFUNDED"
    case "UNDER_DISPUTE":
      return "DISPUTED"
    case "EXPIRED":
      return "EXPIRED"
    case "CANCELLED":
      return "CANCELED"
    case "FAILED":
      return "FAILED"
    default:
      return "UNKNOWN"
  }
}
