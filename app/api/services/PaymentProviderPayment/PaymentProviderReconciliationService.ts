import type { IPlatformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import type { IPaymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/IPaymentProviderIdentityRepository"
import type {
  IPaymentProviderSessionRepository,
  StoredPaymentProviderAttemptRecord,
} from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { PaymentQueryCapability } from "@/lib/payment-provider/contracts"
import type { PaymentMethod } from "@/lib/payment-provider/types"
import { createPaymentOwnerSettlement } from "./paymentOwnerSettlementComposition"
import { SETTLED_OWNER_TYPES, type PaymentOwnerSettlement } from "./PaymentOwnerSettlementService"

const ROUTE_VERSION = "PAY-PROV-PHASE-3"
const RECONCILIATION_LEASE_TTL_MS = 60 * 1000

export type ReconcilePaymentAttemptInput = {
  readonly attempt: StoredPaymentProviderAttemptRecord
  readonly method: PaymentMethod
  readonly provider: PaymentQueryCapability
}

export type ReconciledPaymentAttempt = {
  readonly attemptId: string
  readonly status: StoredPaymentProviderAttemptRecord["status"]
  readonly externalId: string | null
  readonly purchaseStatus: "pending" | "paid"
  readonly requiresReconciliation?: true
}

export type PaymentProviderReconciliationServiceDependencies = {
  readonly sessions: Pick<
    IPaymentProviderSessionRepository,
    "acquireAttemptLease" | "updateAttemptWithLease" | "releaseAttemptLease"
  >
  readonly identities: IPaymentProviderIdentityRepository
  readonly purchases: Pick<IPlatformPurchaseRepository, "markPaidOnceForProvider">
  /** Efeito de domínio dos owners sem compra (adesão, regularização). */
  readonly settlement?: PaymentOwnerSettlement
  readonly now?: () => Date
}

export class PaymentProviderReconciliationService {
  private readonly now: () => Date
  private readonly settlement: PaymentOwnerSettlement

  constructor(private readonly dependencies: PaymentProviderReconciliationServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date())
    this.settlement = dependencies.settlement ?? createPaymentOwnerSettlement()
  }

  async reconcile(input: ReconcilePaymentAttemptInput): Promise<ReconciledPaymentAttempt> {
    if (input.attempt.status !== "UNKNOWN") throw new Error("A tentativa não está UNKNOWN")
    const now = this.now()
    const leased = await this.dependencies.sessions.acquireAttemptLease({
      attemptId: input.attempt.id,
      tenantId: input.attempt.tenantId,
      ownerType: input.attempt.ownerType,
      ownerId: input.attempt.ownerId,
      purpose: "RECONCILIATION",
      now,
      ttlMs: RECONCILIATION_LEASE_TTL_MS,
    })
    let transitioned = false
    try {
      let externalIdToQuery = input.attempt.externalId
      // An attempt may carry the provider's charge id (externalId) from the
      // initial response, or it may only have the attempt-unique reference
      // returned by an indeterminate initiation. If we have the reference but
      // not the charge id, resolve it via the provider's list endpoint.
      if (!externalIdToQuery && input.attempt.reconciliationReference) {
        const resolved = input.provider.findPaymentIdByReference
          ? await input.provider.findPaymentIdByReference({
              reference: input.attempt.reconciliationReference,
              method: input.method,
            })
          : null
        if (resolved) externalIdToQuery = resolved
      }

      if (!externalIdToQuery) {
        return {
          attemptId: input.attempt.id,
          status: "UNKNOWN",
          externalId: null,
          purchaseStatus: "pending",
          requiresReconciliation: true,
        }
      }

      const result = await input.provider.getStatus({
        externalId: externalIdToQuery,
        method: input.method,
      })
      if (result.status === "UNKNOWN") {
        return {
          attemptId: input.attempt.id,
          status: "UNKNOWN",
          externalId: input.attempt.externalId,
          purchaseStatus: "pending",
          requiresReconciliation: true,
        }
      }

      await this.dependencies.identities.bind({
        provider: input.attempt.provider,
        environment: input.attempt.environment,
        externalAccountContext: input.attempt.externalAccountContext,
        externalId: result.externalId,
        identityType: "PAYMENT",
        ownerType: input.attempt.ownerType,
        ownerId: input.attempt.ownerId,
        tenantId: input.attempt.tenantId,
        route: "NEW_ROUTER",
        routeVersion: ROUTE_VERSION,
      })

      let purchaseStatus: "pending" | "paid" = "pending"
      if (result.status === "CONFIRMED" && input.attempt.ownerType === "PLATFORM_PURCHASE") {
        await this.dependencies.purchases.markPaidOnceForProvider({
          id: input.attempt.ownerId,
          provider: input.attempt.provider,
          externalId: result.externalId,
          paidAt: this.now(),
        })
        purchaseStatus = "paid"
      }
      if (result.status === "CONFIRMED" && SETTLED_OWNER_TYPES.has(input.attempt.ownerType)) {
        // Efeito de domínio ANTES da transição: se falhar, a tentativa segue UNKNOWN e o
        // próximo ciclo do cron reconcilia de novo.
        await this.settlement.settleConfirmed({
          ownerType: input.attempt.ownerType,
          ownerId: input.attempt.ownerId,
          externalId: result.externalId,
          amountInCents: result.amountInCents,
          paidAt: this.now(),
        })
        purchaseStatus = "paid"
      }

      const updated = await this.dependencies.sessions.updateAttemptWithLease({
        attemptId: input.attempt.id,
        tenantId: input.attempt.tenantId,
        ownerType: input.attempt.ownerType,
        ownerId: input.attempt.ownerId,
        lease: leased.lease,
        now: this.now(),
        status: result.status,
        expectedStatus: "UNKNOWN",
        operation: "RECONCILIATION",
        externalId: result.externalId,
        reconciliationReference: undefined,
      })
      transitioned = true
      return {
        attemptId: updated.id,
        status: updated.status,
        externalId: updated.externalId,
        purchaseStatus,
      }
    } finally {
      if (!transitioned)
        await releaseLeaseBestEffort(
          this.dependencies.sessions,
          leased.id,
          leased.lease,
          this.now(),
        )
    }
  }
}

async function releaseLeaseBestEffort(
  sessions: Pick<IPaymentProviderSessionRepository, "releaseAttemptLease">,
  attemptId: string,
  lease: StoredPaymentProviderAttemptRecord["lease"],
  now: Date,
): Promise<void> {
  try {
    await sessions.releaseAttemptLease({ attemptId, lease, now })
  } catch (error) {
    console.error("[PaymentProviderReconciliationService][release] Error", {
      attemptId,
      message: error instanceof Error ? error.message : "unknown",
    })
  }
}
