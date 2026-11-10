import type { IBillingGracePaymentService } from "./IBillingGracePaymentService";
import type {
  BillingGraceCardInput,
  BillingGracePaymentQuote,
  BillingGracePaymentRecord,
} from "../context/BillingGracePaymentTypes"
import { API_CLIENT_BASE } from "@/lib/route-map"

const ENDPOINT = `${API_CLIENT_BASE}/billing-grace-payment`

export class BillingGracePaymentService implements IBillingGracePaymentService {
  async request<T>(supabaseId: string, init: RequestInit, options: { paymentId?: string; path?: string } = {}): Promise<T> {
    const query = options.paymentId ? `?paymentId=${encodeURIComponent(options.paymentId)}` : ""
    const response = await fetch(`${ENDPOINT}${options.path ?? ""}${query}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!result.isValid) {
      throw new Error(result.errorMessages?.join(", ") ?? "Request failed");
    }

    return result.result as T;
  }

  getQuote(supabaseId: string): Promise<BillingGracePaymentQuote> {
    return this.request<BillingGracePaymentQuote>(supabaseId, { method: "GET" })
  }

  createPayment(
    supabaseId: string,
    idempotencyKey: string,
    cycle: string,
    keptUserIds: string[]
  ): Promise<BillingGracePaymentRecord> {
    return this.request<BillingGracePaymentRecord>(supabaseId, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey, cycle, keptUserIds }),
    })
  }

  /** Cobra o token do cartão (uso único, 60s). Rota própria: nunca cai na cobrança PIX. */
  createCardPayment(
    supabaseId: string,
    idempotencyKey: string,
    input: BillingGraceCardInput
  ): Promise<BillingGracePaymentRecord> {
    return this.request<BillingGracePaymentRecord>(
      supabaseId,
      {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey,
          cycle: input.cycle,
          keptUserIds: input.keptUserIds,
          cardToken: input.cardToken,
          installments: input.installments,
        }),
      },
      { path: "/card" }
    )
  }

  getPayment(supabaseId: string, paymentId: string): Promise<BillingGracePaymentRecord> {
    return this.request<BillingGracePaymentRecord>(supabaseId, { method: "GET" }, { paymentId })
  }
}
