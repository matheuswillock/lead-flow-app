import type {
  BackofficeProduct,
  BackofficeProductBillingMode,
  BackofficeProductPaymentRule,
  BackofficeProductType,
} from "@prisma/client"

export type BackofficeProductWithPaymentRules = BackofficeProduct & {
  paymentRules: BackofficeProductPaymentRule[]
}

export interface CreateBackofficeProductInput {
  name: string
  featureSlugs: string[]
  description?: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceQuadrimester?: number | null
  priceSemiannual?: number | null
  priceAnnual?: number | null
  priceLifetime?: number | null
  isDefault?: boolean
  isActive?: boolean
}

export interface UpdateBackofficeProductInput {
  name?: string
  featureSlugs?: string[]
  description?: string | null
  type?: BackofficeProductType
  billingMode?: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceQuadrimester?: number | null
  priceSemiannual?: number | null
  priceAnnual?: number | null
  priceLifetime?: number | null
  isDefault?: boolean
  isActive?: boolean
}

export interface IBackofficeProductRepository {
  findAll(): Promise<BackofficeProduct[]>
  findAllWithPaymentRules(): Promise<BackofficeProductWithPaymentRules[]>
  findById(id: string): Promise<BackofficeProduct | null>
  findByIdWithPaymentRules(id: string): Promise<BackofficeProductWithPaymentRules | null>
  findByFeatureSlug(featureSlug: string): Promise<BackofficeProduct[]>
  findByFeatureSlugWithPaymentRules(featureSlug: string): Promise<BackofficeProductWithPaymentRules[]>
  findDefaultByFeatureSlug(featureSlug: string): Promise<BackofficeProduct | null>
  findDefaultByFeatureSlugWithPaymentRules(
    featureSlug: string
  ): Promise<BackofficeProductWithPaymentRules | null>
  countByFeatureSlug(featureSlug: string): Promise<number>
  create(data: CreateBackofficeProductInput): Promise<BackofficeProduct>
  update(id: string, data: UpdateBackofficeProductInput): Promise<BackofficeProduct>
  clearDefaultForFeatureSlug(featureSlug: string, exceptId?: string): Promise<void>
  upsertPaymentRules(productId: string, rules: UpsertPaymentRuleInput[]): Promise<void>
  /**
   * Substitui o conjunto de regras do produto pelos enviados.
   * Ciclos em `lockedCycles` não podem ser removidos nem ter price/schedule alterados.
   */
  syncPaymentRules(
    productId: string,
    rules: UpsertPaymentRuleInput[],
    lockedCycles: Array<"monthly" | "quarterly" | "quadrimester" | "semiannual" | "annual">
  ): Promise<{ blockedRemovals: string[]; blockedUpdates: string[] }>
  findLockedBillingCycles(
    productId: string
  ): Promise<Array<"monthly" | "quarterly" | "quadrimester" | "semiannual" | "annual">>
  delete(id: string): Promise<void>
  hasActiveSubscriptions(id: string): Promise<boolean>
}

export interface UpsertPaymentRuleInput {
  paymentMethod: "PIX" | "CREDIT_CARD"
  billingCycle: "monthly" | "quarterly" | "quadrimester" | "semiannual" | "annual"
  price: number
  canInstallment: boolean
  maxInstallments: number
  installmentSplitMode?: "EQUAL" | "CUSTOM"
  installmentSchedule?: number[]
}
