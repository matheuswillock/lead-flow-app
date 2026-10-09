import type { AsaasAccountId } from "@/lib/asaas"

export type BillingQuoteStatus = "aligned" | "divergent" | "blocked"

export type BillingCycle =
  | "monthly"
  | "quarterly"
  | "quadrimester"
  | "semiannual"
  | "annual"

export type BillingQuoteProduct = {
  productId: string
  slug: string
  name: string
  quantity: number
  unitAmount: number
  totalAmount: number
}

export type BillingQuoteAdjustment = { description: string; amount: number }

export type BillingQuote = {
  billingOwnerId: string
  billingCycle?: BillingCycle | null
  products: BillingQuoteProduct[]
  billableActiveMembers: number
  additionalTeams: number
  adjustments: BillingQuoteAdjustment[]
  recurringAmount: number
  currentAsaasAmount: number | null
  status: BillingQuoteStatus
  blockingReasons: string[]
}

export type BillingQuoteCatalogItem = {
  productId: string
  slug: string
  name: string
  unitAmount: number
}

export type BillingQuoteInput = {
  billingOwnerId: string
  billingCycle: BillingCycle | null
  baseProduct: BillingQuoteCatalogItem | null
  extraUserProduct: BillingQuoteCatalogItem | null
  extraTeamProduct: BillingQuoteCatalogItem | null
  billableActiveMembers: number
  activeTeams: number
  /** Capacidade adicional recorrente já contratada no produto. */
  includedExtraUsers: number
  includedExtraTeams: number
  /** Crédito adicional recorrente já pago; aumenta a capacidade faturável. */
  manualAdjustmentExtraUsers: number
  manualAdjustmentExtraTeams: number
  currentAsaasAmount: number | null
  externalBlockingReasons?: string[]
  hasPermanentSubscription: boolean
  hasUnlimitedUsers: boolean
}

export type BillingQuoteProjection = Omit<BillingQuoteInput, "currentAsaasAmount"> & {
  asaasSubscriptionId: string | null
  asaasSubscriptionAccount: AsaasAccountId | null
}

export type BillingQuoteAccess = {
  billingOwnerId: string
  isMaster: boolean
  isBanned: boolean
}
