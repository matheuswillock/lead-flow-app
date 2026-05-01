export type BackofficeProductType = "PLAN" | "ADDON"
export type BackofficeProductBillingMode = "RECURRING" | "LIFETIME"

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
}
