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
    "listAttempts" | "acquireAttemptLease" | "releaseAttemptLease"
  >
  readonly purchases: Pick<IPlatformPurchaseRepository, "findById">
  readonly reconciliation: Pick<PaymentProviderReconciliationService, "reconcile">
  readonly resolveQueryProvider: QueryProviderResolver
  readonly applyEmailCredits: (input: {
    readonly paymentId: string
    readonly checkoutId: string
    readonly productSlug: string
  }) => Promise<ApplyEmailCreditsPaidPurchaseResult>
}

export type PaymentProviderMaintenanceResult = {
  readonly reconciled: number
  readonly stillUnknown: number
  readonly skipped: number
  readonly entitlementsApplied: number
  readonly entitlementsAlreadyApplied: number
  readonly entitlementFailures: number
}

export class PaymentProviderMaintenanceService {
  constructor(private readonly dependencies: PaymentProviderMaintenanceDependencies) {}

  async run(input: { limit?: number } = {}): Promise<PaymentProviderMaintenanceResult> {
    const limit = input.limit ?? DEFAULT_BATCH_SIZE
    const unknownAttempts = await this.dependencies.sessions.listAttempts({
      status: "UNKNOWN",
      limit,
    })
    let reconciled = 0
    let stillUnknown = 0
    let skipped = 0

    for (const attempt of unknownAttempts) {
      const purchase = await this.dependencies.purchases.findById(attempt.ownerId)
      if (attempt.ownerType !== "PLATFORM_PURCHASE" || !purchase) {
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

    const confirmedAttempts = await this.dependencies.sessions.listAttempts({
      status: "CONFIRMED",
      limit,
    })
    let entitlementsApplied = 0
    let entitlementsAlreadyApplied = 0
    let entitlementFailures = 0
    for (const attempt of confirmedAttempts) {
      if (attempt.ownerType !== "PLATFORM_PURCHASE" || !attempt.externalId) continue
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

    return {
      reconciled,
      stillUnknown,
      skipped,
      entitlementsApplied,
      entitlementsAlreadyApplied,
      entitlementFailures,
    }
  }
}

function paymentMethodFromBillingType(billingType: string | null): PaymentMethod | null {
  if (billingType === "PIX") return "PIX"
  if (billingType === "CREDIT_CARD") return "CARD"
  return null
}
