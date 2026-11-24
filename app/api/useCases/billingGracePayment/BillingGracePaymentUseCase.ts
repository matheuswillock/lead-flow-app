import { Output } from "@/lib/output"
import type { BillingGraceTermsAcceptance, IBillingGracePaymentService } from "@/app/api/services/BillingGracePayment/IBillingGracePaymentService"
import type { IBillingGracePaymentUseCase } from "./IBillingGracePaymentUseCase"

export class BillingGracePaymentUseCase implements IBillingGracePaymentUseCase {
  constructor(private readonly service: IBillingGracePaymentService) {}

  async getQuote(supabaseId: string): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getQuote(supabaseId))
    } catch (error) {
      return this.failure("getQuote", error)
    }
  }

  async createPixPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[] }): Promise<Output> {
    try {
      if (!input.idempotencyKey.trim()) {
        return new Output(false, [], ["Idempotency key é obrigatória"], null)
      }
      if (!input.cycle.trim()) {
        return new Output(false, [], ["Escolha o prazo da renovação"], null)
      }
      return new Output(true, ["Pagamento PIX iniciado"], [], await this.service.createPixPayment(input))
    } catch (error) {
      return this.failure("createPixPayment", error)
    }
  }

  async createCardPayment(input: BillingGraceTermsAcceptance & { supabaseId: string; idempotencyKey: string; cycle: string; keptUserIds?: string[]; cardToken: string; installments: number }): Promise<Output> {
    try {
      if (!input.idempotencyKey.trim() || !input.cycle.trim() || !input.cardToken.startsWith("ctok_")) {
        return new Output(false, [], ["Dados do pagamento com cartão inválidos"], null)
      }
      if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > 12) {
        return new Output(false, [], ["Parcelamento inválido"], null)
      }
      return new Output(true, ["Pagamento com cartão iniciado"], [], await this.service.createCardPayment(input))
    } catch (error) {
      return this.failure("createCardPayment", error)
    }
  }

  async getPayment(input: { id: string; supabaseId: string }): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getPayment(input))
    } catch (error) {
      return this.failure("getPayment", error)
    }
  }

  private failure(operation: string, error: unknown): Output {
    console.error(`[BillingGracePaymentUseCase][${operation}]`, {
      message: error instanceof Error ? error.message : "unknown",
    })
    return new Output(false, [], [error instanceof Error ? error.message : "Erro interno"], null)
  }
}
