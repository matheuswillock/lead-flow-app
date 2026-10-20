import type { IBillingGracePaymentService } from "./IBillingGracePaymentService";
import type { BillingGracePaymentQuote, BillingGracePaymentRecord } from "../context/BillingGracePaymentTypes"
import { API_CLIENT_BASE } from "@/lib/route-map"

export class BillingGracePaymentService implements IBillingGracePaymentService {
  async request<T>(supabaseId: string, init: RequestInit, paymentId?: string): Promise<T> {
    const query = paymentId ? `?paymentId=${encodeURIComponent(paymentId)}` : ""
    const response = await fetch(`${API_CLIENT_BASE}/billing-grace-payment${query}`, {
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

  createPayment(supabaseId: string, idempotencyKey: string): Promise<BillingGracePaymentRecord> {
    return this.request<BillingGracePaymentRecord>(supabaseId, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey }),
    })
  }

  getPayment(supabaseId: string, paymentId: string): Promise<BillingGracePaymentRecord> {
    return this.request<BillingGracePaymentRecord>(supabaseId, { method: "GET" }, paymentId)
  }
}
