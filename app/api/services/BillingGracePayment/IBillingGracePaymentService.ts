import type { BillingGracePayment } from "@prisma/client"

export type BillingGracePaymentQuote = {
  cycle: string
  amountCents: number
  expiresAt: string
  method: "PIX"
}

export interface IBillingGracePaymentService {
  getQuote(supabaseId: string): Promise<BillingGracePaymentQuote>
  createPixPayment(input: {
    supabaseId: string
    idempotencyKey: string
  }): Promise<BillingGracePayment>
  getPayment(input: { id: string; supabaseId: string }): Promise<BillingGracePayment>
}
