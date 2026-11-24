import { Output } from "@/lib/output"
import type { BillingGraceTermsAcceptance } from "@/app/api/services/BillingGracePayment/IBillingGracePaymentService"

export interface IBillingGracePaymentUseCase {
  getQuote(supabaseId: string): Promise<Output>
  createPixPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[] }): Promise<Output>
  createCardPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; cardToken: string; installments: number }): Promise<Output>
  getPayment(input: { id: string; supabaseId: string }): Promise<Output>
}
