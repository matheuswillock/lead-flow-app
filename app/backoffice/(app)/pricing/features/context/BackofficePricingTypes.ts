export type BackofficeProductType = "PLAN" | "ADDON"
export type BackofficeProductBillingMode = "RECURRING" | "LIFETIME"
export type BackofficePaymentMethodKey = "PIX" | "CREDIT_CARD"
export type BackofficeAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual" | "annual"
export type InstallmentSplitMode = "EQUAL" | "CUSTOM"

export interface InstallmentGroup {
  count: string
  value: string
}

export interface BackofficeProductPaymentRuleItem {
  paymentMethod: BackofficePaymentMethodKey
  billingCycle: BackofficeAdhesionBillingCycleKey
  price: number
  canInstallment: boolean
  maxInstallments: number
  installmentSplitMode: InstallmentSplitMode
  installmentSchedule: number[]
}

export interface BackofficeProductPaymentRuleFormEntry {
  pixPrice: string
  cardPrice: string
  maxInstallments: string
  installmentSplitMode: InstallmentSplitMode
  installmentSchedule: InstallmentGroup[]
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
  installmentSplitMode: "EQUAL",
  installmentSchedule: [{ count: "1", value: "" }],
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

export function flattenSchedule(groups: InstallmentGroup[]): number[] {
  const result: number[] = []
  for (const g of groups) {
    const count = Math.max(1, parseInt(g.count, 10) || 1)
    const value = parseFloat(g.value.replace(",", "."))
    if (!isFinite(value) || value <= 0) continue
    for (let i = 0; i < count; i++) result.push(value)
  }
  return result
}

export function groupSchedule(flat: number[]): InstallmentGroup[] {
  if (!flat.length) return [{ count: "1", value: "" }]
  const groups: InstallmentGroup[] = []
  let i = 0
  while (i < flat.length) {
    const val = flat[i]
    let count = 1
    while (i + count < flat.length && flat[i + count] === val) count++
    groups.push({ count: String(count), value: String(val) })
    i += count
  }
  return groups
}
