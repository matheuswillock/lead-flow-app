import type { PaymentProviderRoute } from "@/lib/payment-provider/identity"
import type { ProviderLeaseState } from "@/lib/payment-provider/session"
import type {
  PaymentAttemptStatus,
  PaymentProviderEnvironment,
  PaymentProviderKey,
} from "@/lib/payment-provider/types"

export type CreatePaymentProviderSessionInput = {
  readonly tenantId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly idempotencyKey: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly route: PaymentProviderRoute
  readonly routeVersion: string
  readonly expiresAt: Date
}

export type CreatePaymentProviderAttemptInput = {
  readonly sessionId: string
  readonly tenantId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly now: Date
  readonly attemptNumber: number
  readonly idempotencyKey: string
  readonly requestFingerprint: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
}

export type PaymentProviderSessionRecord = CreatePaymentProviderSessionInput & {
  readonly id: string
  readonly status: "OPEN" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELED"
  readonly route: PaymentProviderRoute
  readonly routeVersion: string
  readonly lease: ProviderLeaseState
}

export type PaymentProviderAttemptRecord = CreatePaymentProviderAttemptInput & {
  readonly id: string
  readonly status: PaymentAttemptStatus
  readonly externalId: string | null
  readonly lease: ProviderLeaseState
}

export type StoredPaymentProviderAttemptRecord = {
  readonly id: string
  readonly sessionId: string
  readonly attemptNumber: number
  readonly idempotencyKey: string
  readonly requestFingerprint: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly tenantId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly status: PaymentAttemptStatus
  readonly externalId: string | null
  readonly unknownReason: string | null
  readonly lease: ProviderLeaseState
}

export type AcquirePaymentProviderAttemptLeaseInput = {
  readonly attemptId: string
  readonly tenantId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly purpose: "PAYMENT" | "POST_PAYMENT" | "RECONCILIATION"
  readonly now: Date
  readonly ttlMs: number
}

export type UpdatePaymentProviderAttemptInput = {
  readonly attemptId: string
  readonly tenantId: string
  readonly ownerType: string
  readonly ownerId: string
  readonly lease: ProviderLeaseState
  readonly now: Date
  readonly status: PaymentAttemptStatus
  readonly expectedStatus: PaymentAttemptStatus
  readonly operation: "PAYMENT" | "POST_PAYMENT" | "RECONCILIATION"
  readonly externalId?: string | null
  readonly unknownReason?: string | null
}

export interface IPaymentProviderSessionRepository {
  createSession(input: CreatePaymentProviderSessionInput): Promise<PaymentProviderSessionRecord>
  createAttempt(
    input: CreatePaymentProviderAttemptInput,
  ): Promise<StoredPaymentProviderAttemptRecord>
  acquireAttemptLease(
    input: AcquirePaymentProviderAttemptLeaseInput,
  ): Promise<StoredPaymentProviderAttemptRecord>
  updateAttemptWithLease(
    input: UpdatePaymentProviderAttemptInput,
  ): Promise<StoredPaymentProviderAttemptRecord>
}
