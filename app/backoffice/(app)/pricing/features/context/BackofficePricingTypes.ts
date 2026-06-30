export type BackofficeProductType = "PLAN" | "ADDON"
export type BackofficeProductBillingMode = "RECURRING" | "LIFETIME"
export type BackofficePaymentMethodKey = "PIX" | "CREDIT_CARD"
export type BackofficeAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual" | "annual"

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
  featureSlug: string
  description: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: number | null
  priceQuarterly: number | null
  priceSemiannual: number | null
  priceAnnual: number | null
  priceLifetime: number | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  paymentRules: BackofficeProductPaymentRuleItem[]
}

export interface BackofficeProductFormData {
  name: string
  featureSlug: string
  description: string
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: string
  priceQuarterly: string
  priceSemiannual: string
  priceAnnual: string
  priceLifetime: string
  isDefault: boolean
  isActive: boolean
  paymentRules: {
    monthly: BackofficeProductPaymentRuleFormEntry
    quarterly: BackofficeProductPaymentRuleFormEntry
    semiannual: BackofficeProductPaymentRuleFormEntry
    annual: BackofficeProductPaymentRuleFormEntry
  }
}

const EMPTY_RULE_ENTRY: BackofficeProductPaymentRuleFormEntry = {
  pixPrice: "",
  cardPrice: "",
  maxInstallments: "1",
}

export const EMPTY_PRODUCT_FORM: BackofficeProductFormData = {
  name: "",
  featureSlug: "",
  description: "",
  type: "PLAN",
  billingMode: "RECURRING",
  priceMonthly: "",
  priceQuarterly: "",
  priceSemiannual: "",
  priceAnnual: "",
  priceLifetime: "",
  isDefault: false,
  isActive: true,
  paymentRules: {
    monthly: { ...EMPTY_RULE_ENTRY, maxInstallments: "1" },
    quarterly: { ...EMPTY_RULE_ENTRY, maxInstallments: "3" },
    semiannual: { ...EMPTY_RULE_ENTRY, maxInstallments: "6" },
    annual: { ...EMPTY_RULE_ENTRY, maxInstallments: "12" },
  },
}
