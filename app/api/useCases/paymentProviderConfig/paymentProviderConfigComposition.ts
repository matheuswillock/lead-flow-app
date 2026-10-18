import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { PaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/PaymentProviderConfigService"
import { PaymentProviderConfigUseCase } from "./PaymentProviderConfigUseCase"

export const paymentProviderConfigUseCase = new PaymentProviderConfigUseCase(
  new PaymentProviderConfigService(paymentProviderConfigRepository),
)
