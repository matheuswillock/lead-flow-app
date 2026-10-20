import type { BillingGracePaymentQuote, BillingGracePaymentRecord } from "../context/BillingGracePaymentTypes"

export interface IBillingGracePaymentService {
  getQuote(supabaseId: string): Promise<BillingGracePaymentQuote>
  createPayment(supabaseId: string, idempotencyKey: string): Promise<BillingGracePaymentRecord>
  getPayment(supabaseId: string, paymentId: string): Promise<BillingGracePaymentRecord>
}
