import { Output } from "@/lib/output"
import type { IPaymentProviderHealthCheckService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderHealthCheckService"
import type {
  IPaymentProviderHealthCheckUseCase,
  PaymentProviderHealthCheckInput,
} from "./IPaymentProviderHealthCheckUseCase"

export type HealthCheckAuditLogger = {
  info(message: string, context: Record<string, unknown>): void
}

export class PaymentProviderHealthCheckUseCase implements IPaymentProviderHealthCheckUseCase {
  constructor(
    private readonly service: IPaymentProviderHealthCheckService,
    private readonly audit: HealthCheckAuditLogger = { info: console.info },
  ) {}

  async check(input: PaymentProviderHealthCheckInput): Promise<Output> {
    try {
      const configuration = await this.service.check({
        provider: input.provider,
        environment: input.environment,
      })
      this.audit.info("[PaymentProviderHealthCheck][audit]", {
        actorProfileId: input.actor.profileId,
        actorBackofficeUserId: input.actor.backofficeUserId,
        provider: input.provider,
        environment: input.environment,
        healthStatus: configuration.healthStatus,
      })
      return new Output(true, ["Health-check executado"], [], configuration)
    } catch (error) {
      console.error("[PaymentProviderHealthCheckUseCase][check]", error)
      const message =
        error instanceof Error ? error.message : "Não foi possível executar o health-check"
      return new Output(false, [], [message], null)
    }
  }
}
