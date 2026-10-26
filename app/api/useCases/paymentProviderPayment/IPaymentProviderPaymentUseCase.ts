import { Output } from "@/lib/output"
import type { StartPaymentInput } from "@/app/api/services/PaymentProviderPayment/IPaymentProviderPaymentService"

export interface IPaymentProviderPaymentUseCase {
  execute(input: StartPaymentInput): Promise<Output>
}
