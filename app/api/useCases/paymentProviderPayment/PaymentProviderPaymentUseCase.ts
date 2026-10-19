import { Output } from "@/lib/output"
import type { IPaymentProviderPaymentUseCase } from "./IPaymentProviderPaymentUseCase"
import type { IPaymentProviderPaymentService } from "@/app/api/services/PaymentProviderPayment/IPaymentProviderPaymentService"
import type { StartPaymentInput } from "@/app/api/services/PaymentProviderPayment/IPaymentProviderPaymentService"

export class PaymentProviderPaymentUseCase implements IPaymentProviderPaymentUseCase {
  constructor(private paymentProviderPaymentService: IPaymentProviderPaymentService) {}

  async execute(input: StartPaymentInput): Promise<Output> {
    try {
      if (!input.supabaseId?.trim()) {
        return new Output(false, [], ["supabaseId é obrigatório"], null)
      }

      const result = await this.paymentProviderPaymentService.startPayment(input)
      return new Output(true, ["Pagamento iniciado"], [], result)
    } catch (error) {
      console.error("[PaymentProviderPaymentUseCase] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro interno ao iniciar pagamento"],
        null,
      )
    }
  }
}
