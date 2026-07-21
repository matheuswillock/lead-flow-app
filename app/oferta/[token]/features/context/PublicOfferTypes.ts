export interface PublicOfferItem {
  productId: string
  name: string
  description: string | null
  type: string
  priceMonthly: number | null
  priceQuarterly: number | null
  priceSemiannual: number | null
  priceAnnual: number | null
  priceLifetime: number | null
}

export type PublicOfferStatus = "active" | "expired"

export interface PublicOfferShare {
  status: PublicOfferStatus
  leadName: string
  contactName: string
  contactPhone: string
  items?: PublicOfferItem[]
  expiresAt?: string
}
