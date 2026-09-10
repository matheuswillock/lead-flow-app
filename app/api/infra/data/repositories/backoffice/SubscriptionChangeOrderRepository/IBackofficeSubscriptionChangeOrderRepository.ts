import type { BackofficeAdhesionBillingCycle } from "@prisma/client"

/** Contexto do plano atual do master (E6/G1) — mesma cadeia real de E5 (assinatura → adesão → produto). */
export interface ChangeOrderMasterContext {
  hasPermanentSubscription: boolean
  currentProductId: string | null
  currentCycle: BackofficeAdhesionBillingCycle | null
  currentChargedAmount: number | null
  currentPeriodEnd: Date | null
}

export interface ChangeOrderTargetProduct {
  id: string
  name: string
  isActive: boolean
  priceMonthly: number | null
  priceQuarterly: number | null
  priceQuadrimester: number | null
  priceSemiannual: number | null
  priceAnnual: number | null
}

export type BackofficeSubscriptionChangeOrderOverrideStatus = "not_required" | "pending" | "approved"
export type BackofficeSubscriptionChangeOrderStatus = "draft" | "awaiting_payment" | "applied" | "canceled"

export interface BackofficeSubscriptionChangeOrderRecord {
  id: string
  masterProfileId: string
  status: BackofficeSubscriptionChangeOrderStatus
  targetProductId: string
  targetCycle: BackofficeAdhesionBillingCycle
  listAmount: number
  proratedAmount: number
  overrideAmount: number | null
  overrideStatus: BackofficeSubscriptionChangeOrderOverrideStatus
  overrideApprovedByProfileId: string | null
  chargeAmount: number
  createdAt: Date
}

export interface CreateBackofficeSubscriptionChangeOrderData {
  masterProfileId: string
  currentProductId: string | null
  currentCycle: BackofficeAdhesionBillingCycle | null
  currentChargedAmount: number | null
  currentPeriodEnd: Date | null
  targetProductId: string
  targetCycle: BackofficeAdhesionBillingCycle
  listAmount: number
  proratedAmount: number
  overrideAmount: number | null
  overrideStatus: BackofficeSubscriptionChangeOrderOverrideStatus
  overrideApprovedByProfileId: string | null
  overrideApprovedAt: Date | null
  chargeAmount: number
  createdByBackofficeUserId: string | null
}

export interface IBackofficeSubscriptionChangeOrderRepository {
  findMasterContext(masterProfileId: string): Promise<ChangeOrderMasterContext | null>
  findTargetProduct(productId: string): Promise<ChangeOrderTargetProduct | null>
  create(data: CreateBackofficeSubscriptionChangeOrderData): Promise<BackofficeSubscriptionChangeOrderRecord>
  findById(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null>
  approveOverride(
    id: string,
    approverProfileId: string
  ): Promise<BackofficeSubscriptionChangeOrderRecord>
}
