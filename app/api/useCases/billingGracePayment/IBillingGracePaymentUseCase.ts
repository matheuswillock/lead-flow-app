import { Output } from "@/lib/output"

export interface IBillingGracePaymentUseCase {
  getQuote(supabaseId: string): Promise<Output>
  createPixPayment(input: { supabaseId: string; idempotencyKey: string }): Promise<Output>
  getPayment(input: { id: string; supabaseId: string }): Promise<Output>
}
