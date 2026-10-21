import type { PaymentProviderRoute } from "@/lib/payment-provider/identity"
import type { ProviderLeaseState } from "@/lib/payment-provider/session"
import type {
  PaymentAttemptStatus,
  PaymentProviderEnvironment,
  PaymentProviderKey,
  ProviderPixInstructions,
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
  readonly reconciliationReference: string | null
  readonly unknownReason: string | null
  readonly paymentInstructions: ProviderPixInstructions | null
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
  readonly reconciliationReference?: string | null
  readonly unknownReason?: string | null
  readonly paymentInstructions?: ProviderPixInstructions
}

export type ApplyPaymentProviderEventInput = {
  readonly externalId: string
  /**
   * Fences the claim by attempt id instead of the external id. Used when a
   * verified webhook resolves an indeterminate attempt through its
   * attempt-unique correlation: the event then adopts `externalId` on the row.
   */
  readonly attemptId?: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly expectedStatus: PaymentAttemptStatus
  readonly nextStatus: PaymentAttemptStatus
  readonly claimToken: string
  readonly now: Date
}

export type ReleasePaymentProviderAttemptLeaseInput = {
  readonly attemptId: string
  readonly lease: ProviderLeaseState
  readonly now: Date
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
  findAttemptByExternalId(input: {
    readonly externalId: string
    readonly provider: PaymentProviderKey
    readonly environment: PaymentProviderEnvironment
    readonly externalAccountContext: string
  }): Promise<StoredPaymentProviderAttemptRecord | null>
  /** Tentativa mais relevante do dono (CONFIRMED primeiro, depois a mais recente). */
  findLatestAttemptByOwner(input: {
    readonly ownerType: string
    readonly ownerId: string
  }): Promise<StoredPaymentProviderAttemptRecord | null>
  applyEventWithClaim(
    input: ApplyPaymentProviderEventInput,
  ): Promise<StoredPaymentProviderAttemptRecord>
  findAttemptById(attemptId: string): Promise<StoredPaymentProviderAttemptRecord | null>
  listAttempts(input: {
    readonly status: PaymentAttemptStatus
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  listAttemptsPendingReconciliation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  listAttemptsPendingEmailCreditEntitlements(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  listAttemptsPendingPurchaseActivation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  /**
   * Reparo dos owners sem compra (adesão e regularização): tentativa CONFIRMED cujo registro
   * do owner ainda não concluiu o efeito de domínio.
   */
  listOwnerAttemptsPendingSettlement(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  /** Tentativas UNKNOWN dos owners sem compra que ainda podem ser reconciliadas. */
  listOwnerAttemptsPendingReconciliation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]>
  releaseAttemptLease(input: ReleasePaymentProviderAttemptLeaseInput): Promise<void>
}
