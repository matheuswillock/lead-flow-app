import { describe, expect, it, mock } from "bun:test"
import type { PlatformPurchase } from "@prisma/client"
import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PaymentProviderMaintenanceService } from "./PaymentProviderMaintenanceService"

const lease = {
  leaseToken: "11111111-1111-1111-1111-111111111111",
  leaseUntil: new Date("2026-10-18T12:01:00.000Z"),
  fenceVersion: 1,
}

function makeAttempt(
  overrides: Partial<StoredPaymentProviderAttemptRecord> = {},
): StoredPaymentProviderAttemptRecord {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    attemptNumber: 1,
    idempotencyKey: "idempotency-1",
    requestFingerprint: "fingerprint-1",
    provider: "ABACATE_PAY",
    environment: "DEV",
    externalAccountContext: "abacate-dev",
    tenantId: "profile-1",
    ownerType: "PLATFORM_PURCHASE",
    ownerId: "purchase-1",
    status: "UNKNOWN",
    externalId: "abacate-payment-1",
    unknownReason: "REMOTE_TIMEOUT",
    paymentInstructions: null,
    lease,
    ...overrides,
  }
}

function makePurchase(overrides: Partial<PlatformPurchase> = {}): PlatformPurchase {
  return {
    id: "purchase-1",
    profileId: "profile-1",
    teamId: "team-1",
    productSlug: "email-credits-pro",
    purchaseType: "email_credits",
    status: "paid",
    billingType: "PIX",
    amount: "10.00" as never,
    quantity: 1,
    description: null,
    metadata: null,
    asaasPaymentId: null,
    asaasAccount: "primary",
    asaasCustomerId: null,
    externalReference: "platform-purchase:purchase-1",
    paidAt: new Date("2026-10-18T12:00:00.000Z"),
    appliedAt: null,
    createdAt: new Date("2026-10-18T11:00:00.000Z"),
    updatedAt: new Date("2026-10-18T12:00:00.000Z"),
    ...overrides,
  }
}

describe("PaymentProviderMaintenanceService", () => {
  it("reconcilia UNKNOWN e aplica entitlement confirmado sob lease", async () => {
    const unknownAttempt = makeAttempt()
    const confirmedAttempt = makeAttempt({
      id: "attempt-2",
      status: "CONFIRMED",
      externalId: "abacate-payment-2",
    })
    const listAttemptsPendingReconciliation = mock(async () => [unknownAttempt])
    const listAttemptsPendingEmailCreditEntitlements = mock(async () => [confirmedAttempt])
    const acquireAttemptLease = mock(async ({ attemptId }: { attemptId: string }) =>
      makeAttempt({ id: attemptId, status: "CONFIRMED" }),
    )
    const releaseAttemptLease = mock(async () => undefined)
    const reconcile = mock(async () => ({
      attemptId: unknownAttempt.id,
      status: "UNKNOWN" as const,
      externalId: unknownAttempt.externalId,
      purchaseStatus: "pending" as const,
      requiresReconciliation: true as const,
    }))
    const applyEmailCredits = mock(async () => ({
      handled: true,
      applied: true,
      alreadyApplied: false,
    }))

    const service = new PaymentProviderMaintenanceService({
      sessions: {
        listAttemptsPendingReconciliation,
        listAttemptsPendingEmailCreditEntitlements,
        acquireAttemptLease,
        releaseAttemptLease,
      },
      purchases: { findById: async () => makePurchase() },
      reconciliation: { reconcile },
      resolveQueryProvider: () => ({
        getStatus: mock(async () => {
          throw new Error("unused")
        }),
      }),
      applyEmailCredits,
    })

    const result = await service.run({ limit: 10 })

    expect(result).toEqual({
      reconciled: 0,
      stillUnknown: 1,
      skipped: 0,
      entitlementsApplied: 1,
      entitlementsAlreadyApplied: 0,
      entitlementFailures: 0,
    })
    expect(listAttemptsPendingReconciliation).toHaveBeenCalledWith({ limit: 10 })
    expect(listAttemptsPendingEmailCreditEntitlements).toHaveBeenCalledWith({ limit: 10 })
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(applyEmailCredits).toHaveBeenCalledWith({
      paymentId: "abacate-payment-2",
      checkoutId: "purchase-1",
      productSlug: "email-credits-pro",
    })
    expect(releaseAttemptLease).toHaveBeenCalledTimes(1)
  })

  it("não tenta entitlement para compras que não são de créditos", async () => {
    const confirmedAttempt = makeAttempt({ status: "CONFIRMED" })
    const applyEmailCredits = mock(async () => ({
      handled: true,
      applied: true,
      alreadyApplied: false,
    }))
    const service = new PaymentProviderMaintenanceService({
      sessions: {
        listAttemptsPendingReconciliation: async () => [],
        listAttemptsPendingEmailCreditEntitlements: async () => [confirmedAttempt],
        acquireAttemptLease: async () => {
          throw new Error("não deveria adquirir lease")
        },
        releaseAttemptLease: async () => undefined,
      },
      purchases: {
        findById: async () => makePurchase({ purchaseType: "feature_addon" }),
      },
      reconciliation: {
        reconcile: async () => {
          throw new Error("não deveria reconciliar")
        },
      },
      resolveQueryProvider: () => ({
        getStatus: async () => {
          throw new Error("não deveria consultar")
        },
      }),
      applyEmailCredits,
    })

    const result = await service.run()

    expect(result.entitlementsApplied).toBe(0)
    expect(applyEmailCredits).not.toHaveBeenCalled()
  })

  it("não aplica entitlement quando a lease não é adquirida", async () => {
    const confirmedAttempt = makeAttempt({
      id: "attempt-3",
      status: "CONFIRMED",
      externalId: "abacate-payment-3",
    })
    const applyEmailCredits = mock(async () => ({
      handled: true,
      applied: true,
      alreadyApplied: false,
    }))
    const service = new PaymentProviderMaintenanceService({
      sessions: {
        listAttemptsPendingReconciliation: async () => [],
        listAttemptsPendingEmailCreditEntitlements: async () => [confirmedAttempt],
        acquireAttemptLease: async () => {
          throw new Error("lease indisponível")
        },
        releaseAttemptLease: async () => undefined,
      },
      purchases: { findById: async () => makePurchase() },
      reconciliation: {
        reconcile: async () => {
          throw new Error("não deveria reconciliar")
        },
      },
      resolveQueryProvider: () => ({
        getStatus: async () => {
          throw new Error("não deveria consultar")
        },
      }),
      applyEmailCredits,
    })

    const result = await service.run()

    expect(result.entitlementsApplied).toBe(0)
    expect(result.entitlementFailures).toBe(1)
    expect(applyEmailCredits).not.toHaveBeenCalled()
  })
})
