import { Output } from "@/lib/output"
import type { IPaymentProviderHealthCheckService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderHealthCheckService"
import type { ProviderInstanceView } from "@/lib/payment-provider/admin-contract"
import { ProviderInstanceNotFoundError } from "@/lib/payment-provider/instance"
import type {
  IPaymentProviderHealthCheckUseCase,
  PaymentProviderHealthCheckInput,
} from "./IPaymentProviderHealthCheckUseCase"

export type HealthCheckAuditLogger = {
  info(message: string, context: Record<string, unknown>): void
}

export type HealthCheckInstanceReader = {
  resolveLegacyTargetId(
    provider: NonNullable<PaymentProviderHealthCheckInput["provider"]>,
    environment: NonNullable<PaymentProviderHealthCheckInput["environment"]>,
  ): Promise<string>
  get(id: string): Promise<ProviderInstanceView>
}

export class PaymentProviderHealthCheckUseCase implements IPaymentProviderHealthCheckUseCase {
  constructor(
    private readonly service: IPaymentProviderHealthCheckService,
    private readonly instances: HealthCheckInstanceReader,
    private readonly audit: HealthCheckAuditLogger = { info: console.info },
  ) {}

  async check(input: PaymentProviderHealthCheckInput): Promise<Output> {
    try {
      const id = await this.resolveId(input)
      await this.service.check({ id, mode: "manual" })
      const view = await this.instances.get(id)
      this.audit.info("[PaymentProviderHealthCheck][audit]", {
        actorProfileId: input.actor.profileId,
        actorBackofficeUserId: input.actor.backofficeUserId,
        instanceId: id,
        provider: view.providerKey,
        environment: view.environment,
        healthStatus: view.healthStatus,
      })
      return new Output(true, ["Health-check executado"], [], view)
    } catch (error) {
      const notFound = error instanceof ProviderInstanceNotFoundError
      console.error("[PaymentProviderHealthCheckUseCase][check]", error instanceof Error ? error.name : "unknown")
      const message = error instanceof Error ? error.message : "Não foi possível executar o health-check"
      return new Output(false, [], [message], { errorCode: notFound ? "NOT_FOUND" : "CONFLICT" })
    }
  }

  private async resolveId(input: PaymentProviderHealthCheckInput): Promise<string> {
    if (input.id) return input.id
    if (!input.provider || !input.environment) throw new Error("Informe o id da instância")
    return this.instances.resolveLegacyTargetId(input.provider, input.environment)
  }
}
