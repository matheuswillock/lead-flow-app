import type { BillingGracePayment } from "@prisma/client"
import type { RenewalCycleQuote } from "@/app/api/shared/billing/renewalQuote"

/** Renovação: o master escolhe o prazo; cada prazo traz quem e o que está sendo cobrado. */
export type BillingGracePaymentQuote = {
  cycles: RenewalCycleQuote[]
  currentCycle: string | null
  /** A conta tem usuários ilimitados hoje (anual ou concedido pelo time interno). */
  hasUnlimitedUsers: boolean
  expiresAt: string
  /** Cartão do Abacate na renovação; `null` enquanto a cobrança no cartão não estiver ligada. */
  cardCheckout: {
    publicKey: string
    payer: { name: string; email: string; taxId: string; cellphone: string }
  } | null
}

/** Carimbo do aceite dos termos na renovação; a rota grava o mesmo par que o add-on grava. */
export type BillingGraceTermsAcceptance = { termsAcceptedAt: string; termsVersion: string }

export interface IBillingGracePaymentService {
  getQuote(supabaseId: string): Promise<BillingGracePaymentQuote>
  createPixPayment(input: BillingGraceTermsAcceptance & {
    supabaseId: string
    idempotencyKey: string
    cycle: string
    /** Usuários adicionais que o master mantém; ausente = todos. */
    keptUserIds?: string[]
  }): Promise<BillingGracePayment>
  createCardPayment(input: BillingGraceTermsAcceptance & {
    supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; cardToken: string; installments: number
  }): Promise<BillingGracePayment>
  getPayment(input: { id: string; supabaseId: string }): Promise<BillingGracePayment>
}
