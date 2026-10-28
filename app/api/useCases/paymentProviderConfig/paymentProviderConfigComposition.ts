import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { PaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/PaymentProviderConfigService"
import { PaymentProviderHealthCheckService } from "@/app/api/services/PaymentProviderConfig/PaymentProviderHealthCheckService"
import { clearCardEnabledCache } from "@/lib/payment-methods/availability"
import { createAbacatePayProvider } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import { PaymentProviderConfigUseCase } from "./PaymentProviderConfigUseCase"
import { PaymentProviderHealthCheckUseCase } from "./PaymentProviderHealthCheckUseCase"

export const paymentProviderConfigUseCase = new PaymentProviderConfigUseCase(
  new PaymentProviderConfigService(paymentProviderConfigRepository),
  { onConfigUpdated: clearCardEnabledCache },
)

export const paymentProviderHealthCheckUseCase = new PaymentProviderHealthCheckUseCase(
  new PaymentProviderHealthCheckService(paymentProviderConfigRepository, (_provider, environment) =>
    createAbacatePayProvider(environment),
  ),
)
