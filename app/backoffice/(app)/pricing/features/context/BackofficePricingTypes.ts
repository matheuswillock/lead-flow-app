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
  featureSlugs: string[]
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

export const BILLING_CYCLE_META: {
  key: BackofficeAdhesionBillingCycleKey
  label: string
  months: number
  defaultMax: number
}[] = [
  { key: "monthly", label: "Mensal", months: 1, defaultMax: 1 },
  { key: "quarterly", label: "Trimestral", months: 3, defaultMax: 3 },
  { key: "semiannual", label: "Semestral", months: 6, defaultMax: 6 },
  { key: "annual", label: "Anual", months: 12, defaultMax: 12 },
]

export const BILLING_CYCLE_LABELS: Record<BackofficeAdhesionBillingCycleKey, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
}

export interface BackofficeProductFormData {
  name: string
  featureSlugs: string[]
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
  /** Ciclos opt-in incluídos nesta precificação (RECURRING). */
  activeCycles: BackofficeAdhesionBillingCycleKey[]
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
  featureSlugs: [],
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
  activeCycles: [],
  paymentRules: {
    monthly: { ...EMPTY_RULE_ENTRY, maxInstallments: "1" },
    quarterly: { ...EMPTY_RULE_ENTRY, maxInstallments: "3" },
    semiannual: { ...EMPTY_RULE_ENTRY, maxInstallments: "6" },
    annual: { ...EMPTY_RULE_ENTRY, maxInstallments: "12" },
  },
}

export function isCycleRuleConfigured(entry: BackofficeProductPaymentRuleFormEntry): boolean {
  const pix = Number.parseFloat(entry.pixPrice.replace(",", "."))
  if (Number.isFinite(pix) && pix > 0) return true
  if (entry.installmentSplitMode === "CUSTOM") {
    return entry.installmentSchedule.some((g) => {
      const count = Number.parseInt(g.count, 10)
      const value = Number.parseFloat(g.value.replace(",", "."))
      return count >= 1 && Number.isFinite(value) && value > 0
    })
  }
  const card = Number.parseFloat(entry.cardPrice.replace(",", "."))
  return Number.isFinite(card) && card > 0
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
