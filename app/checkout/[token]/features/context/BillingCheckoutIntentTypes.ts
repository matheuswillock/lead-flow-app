export type BillingType = "PIX" | "CREDIT_CARD"

export type CheckoutDetails = {
  productSlug: string
  cycle: string
  prices: Record<BillingType, number | null>
  /** Ausente = somente PIX (falha fechada). */
  availableBillingTypes?: BillingType[]
  expiresAt: string
  checkoutCreated?: boolean
}
