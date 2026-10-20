import { Output } from "@/lib/output"
import type { IBillingGracePaymentService } from "@/app/api/services/BillingGracePayment/IBillingGracePaymentService"
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

  async createPixPayment(input: { supabaseId: string; idempotencyKey: string }): Promise<Output> {
    try {
      if (!input.idempotencyKey.trim()) {
        return new Output(false, [], ["Idempotency key é obrigatória"], null)
      }
      return new Output(true, ["Pagamento PIX iniciado"], [], await this.service.createPixPayment(input))
    } catch (error) {
      return this.failure("createPixPayment", error)
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
