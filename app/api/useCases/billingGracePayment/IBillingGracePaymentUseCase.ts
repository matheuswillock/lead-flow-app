import { Output } from "@/lib/output"

export interface IBillingGracePaymentUseCase {
  getQuote(supabaseId: string): Promise<Output>
  createPixPayment(input: { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[] }): Promise<Output>
  createCardPayment(input: { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; cardToken: string; installments: number }): Promise<Output>
  getPayment(input: { id: string; supabaseId: string }): Promise<Output>
}
