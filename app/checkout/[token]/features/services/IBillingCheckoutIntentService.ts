import type { BillingType, CheckoutDetails } from "../context/BillingCheckoutIntentTypes"

export interface IBillingCheckoutIntentService {
  getDetails(token: string): Promise<CheckoutDetails>
  createCheckout(token: string, billingType: BillingType): Promise<{ checkoutUrl: string }>
}
