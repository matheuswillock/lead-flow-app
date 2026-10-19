import type { ApplyEmailCreditsPaidPurchaseResult } from "@/app/api/useCases/email/ApplyEmailCreditsPaidPurchaseUseCase"
import type { IPlatformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import type {
  IPaymentProviderSessionRepository,
  StoredPaymentProviderAttemptRecord,
} from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { PaymentQueryCapability } from "@/lib/payment-provider/contracts"
import type { PaymentMethod } from "@/lib/payment-provider/types"
import { PaymentProviderReconciliationService } from "./PaymentProviderReconciliationService"

const DEFAULT_BATCH_SIZE = 50

type QueryProviderResolver = (input: {
  readonly provider: StoredPaymentProviderAttemptRecord["provider"]
  readonly environment: StoredPaymentProviderAttemptRecord["environment"]
}) => PaymentQueryCapability

export type PaymentProviderMaintenanceDependencies = {
  readonly sessions: Pick<
    IPaymentProviderSessionRepository,
    | "listAttemptsPendingReconciliation"
    | "listAttemptsPendingEmailCreditEntitlements"
    | "listAttemptsPendingPurchaseActivation"
    | "acquireAttemptLease"
    | "releaseAttemptLease"
  >
  readonly purchases: Pick<IPlatformPurchaseRepository, "findById" | "markPaidOnceForProvider">
  readonly reconciliation: Pick<PaymentProviderReconciliationService, "reconcile">
  readonly resolveQueryProvider: QueryProviderResolver
  readonly applyEmailCredits: (input: {
    readonly paymentId: string
    readonly checkoutId: string
    readonly productSlug: string
  }) => Promise<ApplyEmailCreditsPaidPurchaseResult>
  readonly now: () => Date
}

export type PaymentProviderMaintenanceResult = {
  readonly reconciled: number
  readonly stillUnknown: number
  readonly skipped: number
  readonly entitlementsApplied: number
  readonly entitlementsAlreadyApplied: number
  readonly entitlementFailures: number
  readonly purchasesActivated: number
  readonly purchaseActivationFailures: number
}

export class PaymentProviderMaintenanceService {
  private readonly now: () => Date

  constructor(private readonly dependencies: PaymentProviderMaintenanceDependencies) {
    this.now = dependencies.now ?? (() => new Date())
  }

  async run(input: { limit?: number } = {}): Promise<PaymentProviderMaintenanceResult> {
    const limit = input.limit ?? DEFAULT_BATCH_SIZE
    // Only attempts whose purchase can actually be reconciled enter the batch,
    // so permanently ineligible rows never occupy the limit window.
    const unknownAttempts = await this.dependencies.sessions.listAttemptsPendingReconciliation({
      limit,
    })
    let reconciled = 0
    let stillUnknown = 0
    let skipped = 0

    for (const attempt of unknownAttempts) {
      const purchase = await this.dependencies.purchases.findById(attempt.ownerId)
      if (!purchase) {
        skipped += 1
        continue
      }
      const method = paymentMethodFromBillingType(purchase.billingType)
      if (!method) {
        skipped += 1
        continue
      }
      try {
        const result = await this.dependencies.reconciliation.reconcile({
          attempt,
          method,
          provider: this.dependencies.resolveQueryProvider({
            provider: attempt.provider,
            environment: attempt.environment,
          }),
        })
        if (result.requiresReconciliation) stillUnknown += 1
        else reconciled += 1
      } catch (error) {
        console.error("[PaymentProviderMaintenanceService][reconcile] Error", {
          attemptId: attempt.id,
          message: error instanceof Error ? error.message : "unknown",
        })
        skipped += 1
      }
    }

    // Same eligibility filter for the email-credit entitlement batch: only
    // CONFIRMED attempts bound to an email_credits purchase are selected.
    const confirmedAttempts =
      await this.dependencies.sessions.listAttemptsPendingEmailCreditEntitlements({
        limit,
      })
    let entitlementsApplied = 0
    let entitlementsAlreadyApplied = 0
    let entitlementFailures = 0
    for (const attempt of confirmedAttempts) {
      if (!attempt.externalId) continue
      const purchase = await this.dependencies.purchases.findById(attempt.ownerId)
      if (!purchase || purchase.purchaseType !== "email_credits") continue
      let lease: StoredPaymentProviderAttemptRecord | null = null
      try {
        lease = await this.dependencies.sessions.acquireAttemptLease({
          attemptId: attempt.id,
          tenantId: attempt.tenantId,
          ownerType: attempt.ownerType,
          ownerId: attempt.ownerId,
          purpose: "POST_PAYMENT",
          now: new Date(),
          ttlMs: 60_000,
        })
        const result = await this.dependencies.applyEmailCredits({
          paymentId: attempt.externalId,
          checkoutId: purchase.id,
          productSlug: purchase.productSlug,
        })
        if (result.applied) entitlementsApplied += 1
        if (result.alreadyApplied) entitlementsAlreadyApplied += 1
      } catch (error) {
        entitlementFailures += 1
        console.error("[PaymentProviderMaintenanceService][entitlement] Error", {
          attemptId: attempt.id,
          message: error instanceof Error ? error.message : "unknown",
        })
      } finally {
        if (lease) {
          try {
            await this.dependencies.sessions.releaseAttemptLease({
              attemptId: lease.id,
              lease: lease.lease,
              now: new Date(),
            })
          } catch (error) {
            entitlementFailures += 1
            console.error("[PaymentProviderMaintenanceService][release] Error", {
              attemptId: lease.id,
              message: error instanceof Error ? error.message : "unknown",
            })
          }
        }
      }
    }

    // Repair pass: purchases whose attempt is CONFIRMED but whose purchase
    // projection has not yet been updated (e.g. crash between the fenced
    // attempt transition and the purchase activation). Only purchases still
    // accepting payment enter the batch.
    let purchasesActivated = 0
    let purchaseActivationFailures = 0
    const confirmedAttemptsForActivation =
      await this.dependencies.sessions.listAttemptsPendingPurchaseActivation({
        limit,
      })
    for (const attempt of confirmedAttemptsForActivation) {
      if (!attempt.externalId) continue
      const purchase = await this.dependencies.purchases.findById(attempt.ownerId)
      if (!purchase) continue
      try {
        const activated = await this.dependencies.purchases.markPaidOnceForProvider({
          id: purchase.id,
          provider: attempt.provider,
          externalId: attempt.externalId,
          paidAt: this.now(),
        })
        if (activated) purchasesActivated += 1
      } catch (error) {
        purchaseActivationFailures += 1
        console.error("[PaymentProviderMaintenanceService][activation] Error", {
          attemptId: attempt.id,
          message: error instanceof Error ? error.message : "unknown",
        })
      }
    }

    return {
      reconciled,
      stillUnknown,
      skipped,
      entitlementsApplied,
      entitlementsAlreadyApplied,
      entitlementFailures,
      purchasesActivated,
      purchaseActivationFailures,
    }
  }
}

function paymentMethodFromBillingType(billingType: string | null): PaymentMethod | null {
  if (billingType === "PIX") return "PIX"
  if (billingType === "CREDIT_CARD") return "CARD"
  return null
}
