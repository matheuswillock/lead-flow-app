import type { IPaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type {
  HealthCheckCapability,
  ProviderHealthCheckResult,
} from "@/lib/payment-provider/contracts"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type {
  CheckPaymentProviderHealthInput,
  IPaymentProviderHealthCheckService,
} from "./IPaymentProviderHealthCheckService"

export type HealthCheckProviderFactory = (
  provider: PaymentProviderKey,
  environment: PaymentProviderEnvironment,
) => HealthCheckCapability

const CONFIGURATION_UNHEALTHY: ProviderHealthCheckResult = {
  healthy: false,
  errorCode: "CONFIGURATION_INVALID",
  errorMessage: "Credenciais do provider ausentes ou inválidas",
}

const UNEXPECTED_UNHEALTHY: ProviderHealthCheckResult = {
  healthy: false,
  errorCode: "HEALTH_CHECK_FAILED",
  errorMessage: "Falha inesperada ao sondar o provider",
}

export class PaymentProviderHealthCheckService implements IPaymentProviderHealthCheckService {
  constructor(
    private readonly repository: IPaymentProviderConfigRepository,
    private readonly createProvider: HealthCheckProviderFactory,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async check(input: CheckPaymentProviderHealthInput) {
    if (input.provider !== "ABACATE_PAY") {
      throw new Error("Health-check não suportado para este provider")
    }
    const result = await this.probe(input)
    return this.repository.recordHealthCheck({
      provider: input.provider,
      environment: input.environment,
      healthStatus: result.healthy ? "HEALTHY" : "UNHEALTHY",
      checkedAt: this.now(),
      errorCode: result.healthy ? null : result.errorCode,
      errorMessage: result.healthy ? null : result.errorMessage,
    })
  }

  private async probe(input: CheckPaymentProviderHealthInput): Promise<ProviderHealthCheckResult> {
    let provider: HealthCheckCapability
    try {
      provider = this.createProvider(input.provider, input.environment)
    } catch {
      return CONFIGURATION_UNHEALTHY
    }
    try {
      return await provider.checkHealth()
    } catch {
      return UNEXPECTED_UNHEALTHY
    }
  }
}
