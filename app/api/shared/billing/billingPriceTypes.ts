export type BillingPriceCycle = "monthly" | "quarterly" | "quadrimester" | "semiannual" | "annual"

export type BillingPriceMethod = "PIX" | "CREDIT_CARD" | "BOLETO"

export type BillingPriceInput = {
  featureSlug: string
  productId?: string
  cycle: BillingPriceCycle
  method: BillingPriceMethod
}

export interface IBillingPriceResolver {
  resolvePrice(input: BillingPriceInput): Promise<number | null>
}
