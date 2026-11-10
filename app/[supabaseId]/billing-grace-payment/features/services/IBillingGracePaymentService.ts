import type {
  BillingGraceCardInput,
  BillingGracePaymentQuote,
  BillingGracePaymentRecord,
} from "../context/BillingGracePaymentTypes"

export interface IBillingGracePaymentService {
  getQuote(supabaseId: string): Promise<BillingGracePaymentQuote>
  createPayment(
    supabaseId: string,
    idempotencyKey: string,
    cycle: string,
    keptUserIds: string[]
  ): Promise<BillingGracePaymentRecord>
  createCardPayment(
    supabaseId: string,
    idempotencyKey: string,
    input: BillingGraceCardInput
  ): Promise<BillingGracePaymentRecord>
  getPayment(supabaseId: string, paymentId: string): Promise<BillingGracePaymentRecord>
}
