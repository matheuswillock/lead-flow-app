import { API_CLIENT_BASE } from "@/lib/route-map"
import type { BillingType, CheckoutDetails } from "../context/BillingCheckoutIntentTypes"
import type { IBillingCheckoutIntentService } from "./IBillingCheckoutIntentService"

type ApiResponse<T> = { result?: T; errorMessages?: string[]; error?: string }

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!response.ok || body.result === undefined) {
    throw new Error(body.errorMessages?.[0] ?? body.error ?? "Link de pagamento inválido")
  }
  return body.result
}

export class BillingCheckoutIntentService implements IBillingCheckoutIntentService {
  async getDetails(token: string): Promise<CheckoutDetails> {
    return parse(
      await fetch(`${API_CLIENT_BASE}/billing/checkout-intents/${encodeURIComponent(token)}`, {
        cache: "no-store",
      }),
    )
  }

  async createCheckout(token: string, billingType: BillingType): Promise<{ checkoutUrl: string }> {
    return parse(
      await fetch(`${API_CLIENT_BASE}/billing/checkout-intents/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ billingType }),
      }),
    )
  }
}
