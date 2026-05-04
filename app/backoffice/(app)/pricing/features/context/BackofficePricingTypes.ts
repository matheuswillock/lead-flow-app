export type BackofficeProductType = "PLAN" | "ADDON"
export type BackofficeProductBillingMode = "RECURRING" | "LIFETIME"
export type BackofficePaymentMethodKey = "PIX" | "CREDIT_CARD"
export type BackofficeAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual"

export interface BackofficeProductPaymentRuleItem {
  paymentMethod: BackofficePaymentMethodKey
  billingCycle: BackofficeAdhesionBillingCycleKey
  price: number
  canInstallment: boolean
  maxInstallments: number
}

export interface BackofficeProductPaymentRuleFormEntry {
  pixPrice: string
  cardPrice: string
  maxInstallments: string
}

export interface BackofficeProductItem {
  id: string
  name: string
  slug: string
  description: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: number | null
  priceQuarterly: number | null
  priceSemiannual: number | null
  priceLifetime: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  paymentRules: BackofficeProductPaymentRuleItem[]
}

export interface BackofficeProductFormData {
  name: string
  slug: string
  description: string
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: string
  priceQuarterly: string
  priceSemiannual: string
  priceLifetime: string
  isActive: boolean
  paymentRules: {
    monthly: BackofficeProductPaymentRuleFormEntry
    quarterly: BackofficeProductPaymentRuleFormEntry
    semiannual: BackofficeProductPaymentRuleFormEntry
  }
}

const EMPTY_RULE_ENTRY: BackofficeProductPaymentRuleFormEntry = {
  pixPrice: "",
  cardPrice: "",
  maxInstallments: "1",
}

export const EMPTY_PRODUCT_FORM: BackofficeProductFormData = {
  name: "",
  slug: "",
  description: "",
  type: "PLAN",
  billingMode: "RECURRING",
  priceMonthly: "",
  priceQuarterly: "",
  priceSemiannual: "",
  priceLifetime: "",
  isActive: true,
  paymentRules: {
    monthly: { ...EMPTY_RULE_ENTRY, maxInstallments: "1" },
    quarterly: { ...EMPTY_RULE_ENTRY, maxInstallments: "3" },
    semiannual: { ...EMPTY_RULE_ENTRY, maxInstallments: "6" },
  },
}
