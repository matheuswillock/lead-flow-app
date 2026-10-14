export type BillingType = "PIX" | "CREDIT_CARD"

export type CheckoutDetails = {
  productSlug: string
  cycle: string
  prices: Record<BillingType, number | null>
  expiresAt: string
  checkoutCreated?: boolean
}
