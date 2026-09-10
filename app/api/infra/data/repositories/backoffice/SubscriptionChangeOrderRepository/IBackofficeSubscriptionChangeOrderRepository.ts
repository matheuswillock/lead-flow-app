import type { AsaasAccount, BackofficeAdhesionBillingCycle } from "@prisma/client"

/** Dados de cobrança do master (G2) — o mínimo para criar/verificar customer Asaas. */
export interface ChangeOrderBillingProfile {
  id: string
  fullName: string | null
  email: string
  cpfCnpj: string | null
  phone: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  asaasCustomerId: string | null
  asaasCustomerAccount: AsaasAccount
}

/** Contexto do plano atual do master (E6/G1) — mesma cadeia real de E5 (assinatura → adesão → produto). */
export interface ChangeOrderMasterContext {
  hasPermanentSubscription: boolean
  currentProductId: string | null
  currentCycle: BackofficeAdhesionBillingCycle | null
  currentChargedAmount: number | null
  currentPeriodEnd: Date | null
  billingProfile: ChangeOrderBillingProfile
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
  targetProductName: string
  targetCycle: BackofficeAdhesionBillingCycle
  listAmount: number
  proratedAmount: number
  overrideAmount: number | null
  overrideStatus: BackofficeSubscriptionChangeOrderOverrideStatus
  overrideApprovedByProfileId: string | null
  chargeAmount: number
  asaasPaymentId: string | null
  asaasAccount: AsaasAccount
  paymentInvoiceUrl: string | null
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

export interface AttachSubscriptionChangeOrderPaymentData {
  asaasPaymentId: string
  asaasAccount: AsaasAccount
  paymentInvoiceUrl: string | null
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
  /** G2: persiste o customer recém-criado — SEMPRE na conta primary (DA6). */
  updateMasterAsaasCustomer(masterProfileId: string, customerId: string): Promise<void>
  /** G2: anexa a cobrança gerada e transiciona `draft` → `awaiting_payment`. */
  attachPayment(
    id: string,
    data: AttachSubscriptionChangeOrderPaymentData
  ): Promise<BackofficeSubscriptionChangeOrderRecord>
}
